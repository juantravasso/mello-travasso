"use server";

import { prisma } from "@/lib/prisma";
import { exigirAdminAction } from "@/lib/auth/dal";
import { calcularFimDoTeste } from "@/lib/auth/plano";
import { formatarCpfCnpj } from "@/lib/documento";
import { alterarPlanoSchema, alvoSchema, bloquearSchema, buscaAdminSchema } from "@/lib/validacao/admin";
import type { EmpresaAdminItem, ResultadoAction } from "@/types";
import { registrarLogAdmin } from "./adminLog.server";
import { obterConfigCiclo } from "./cicloDeVidaCore.server";
import { registrarEvento } from "./eventosCore.server";
import { nomeParaAdmin } from "./avaliacaoCore.server";
import { aplicarSuspensaoPerfil } from "./moderacaoCore.server";
import { exigirSenhaDoAdmin } from "./reautenticacao.server";
import { ErroDeNegocio, executar } from "./resultado.server";

/** CPF nunca aparece inteiro na administração: só os dois últimos dígitos. */
function documentoParaAdmin(tipo: "pj" | "pf", documento: string): string {
  if (tipo === "pj") return formatarCpfCnpj(documento);
  return `•••.•••.•••-${documento.slice(-2)}`;
}

/** Empresas, mais recentes primeiro, com busca por nome, CNPJ (dígitos) ou e-mail de um usuário. */
export async function listarEmpresasAdmin(busca?: string): Promise<EmpresaAdminItem[]> {
  const admin = await exigirAdminAction();
  const parsed = buscaAdminSchema.safeParse(busca ?? "");
  const termo = parsed.success ? parsed.data.replace(/[%_\\]/g, " ").trim() : "";
  const digitos = termo.replace(/\D/g, "");
  const empresas = await prisma.empresa.findMany({
    where: termo
      ? {
          OR: [
            // Nome e documento só de empresa (PJ): a busca não pode servir de oráculo para descobrir o
            // nome civil ou o CPF de autônomo, que a tela esconde. Autônomo se acha pelo e-mail.
            { tipoPessoa: "pj", razaoSocial: { contains: termo, mode: "insensitive" } },
            { tipoPessoa: "pj", nomeFantasia: { contains: termo, mode: "insensitive" } },
            ...(digitos.length >= 5 ? [{ tipoPessoa: "pj" as const, documento: { startsWith: digitos } }] : []),
            { usuarios: { some: { email: { contains: termo.toLowerCase() } } } },
          ],
        }
      : {},
    include: {
      usuarios: { select: { id: true, email: true, papelPlataforma: true } },
      perfilPublico: { select: { slug: true, status: true } },
    },
    orderBy: [{ criadoEm: "desc" }, { id: "asc" }],
    take: 50,
  });
  return empresas.map((e) => ({
    id: e.id,
    nome: nomeParaAdmin(e),
    tipo: e.tipoPessoa,
    documento: documentoParaAdmin(e.tipoPessoa, e.documento),
    plano: e.plano,
    planoComercial: e.planoComercialChave ?? undefined,
    testeTerminaEm: e.testeTerminaEm ?? undefined,
    bloqueadaEm: e.bloqueadaEm ?? undefined,
    criadoEm: e.criadoEm,
    usuarios: e.usuarios.map((u) => ({ id: u.id, email: u.email })),
    perfilSlug: e.perfilPublico?.slug,
    perfilStatus: e.perfilPublico?.status,
    propria: e.id === admin.empresaId,
    temAdmin: e.usuarios.some((u) => u.papelPlataforma === "admin"),
  }));
}

/**
 * Bloqueia a empresa: ninguém dela entra (as sessões abertas caem) e o perfil
 * público é suspenso. Desbloquear não republica o perfil; isso é decisão à
 * parte, em "Perfis da rede". O motivo fica só no registro interno.
 */
export async function bloquearEmpresa(empresaId: string, motivo: string, senha?: string): Promise<ResultadoAction<null>> {
  const admin = await exigirAdminAction();
  return executar(async () => {
    const parsed = bloquearSchema.safeParse({ alvoId: empresaId, motivo });
    if (!parsed.success) throw new ErroDeNegocio(parsed.error.issues[0]?.message ?? "Dados inválidos.");
    await exigirSenhaDoAdmin(admin.usuarioId, senha);
    if (parsed.data.alvoId === admin.empresaId) throw new ErroDeNegocio("Você não pode bloquear a sua própria empresa.");

    await prisma.$transaction(async (tx) => {
      const empresa = await tx.empresa.findUnique({
        where: { id: parsed.data.alvoId },
        select: {
          id: true,
          bloqueadaEm: true,
          usuarios: { select: { id: true, papelPlataforma: true } },
          perfilPublico: { select: { id: true, status: true } },
        },
      });
      if (!empresa) throw new ErroDeNegocio("Empresa não encontrada.");
      if (empresa.usuarios.some((u) => u.papelPlataforma === "admin")) {
        throw new ErroDeNegocio("Esta empresa tem um administrador da plataforma. Retire o papel de admin antes (yarn admin:promover --remover).");
      }
      const agora = new Date().toISOString();
      const atualizadas = await tx.empresa.updateMany({
        where: { id: empresa.id, bloqueadaEm: null },
        data: { bloqueadaEm: agora, bloqueioMotivo: parsed.data.motivo, atualizadoEm: agora },
      });
      if (atualizadas.count === 0) throw new ErroDeNegocio("Esta empresa já está bloqueada.");
      const sessoes = await tx.sessao.deleteMany({ where: { usuarioId: { in: empresa.usuarios.map((u) => u.id) } } });
      let perfilSuspenso = false;
      if (empresa.perfilPublico && empresa.perfilPublico.status !== "suspenso") {
        await aplicarSuspensaoPerfil(tx, admin.usuarioId, empresa.perfilPublico.id, `Empresa bloqueada: ${parsed.data.motivo}`);
        perfilSuspenso = true;
      }
      await registrarLogAdmin(tx, admin.usuarioId, "empresa.bloquear", "Empresa", empresa.id, {
        motivo: parsed.data.motivo,
        sessoesEncerradas: sessoes.count,
        perfilSuspenso,
      });
    });
    return null;
  });
}

export async function desbloquearEmpresa(empresaId: string, senha?: string): Promise<ResultadoAction<null>> {
  const admin = await exigirAdminAction();
  return executar(async () => {
    const parsed = alvoSchema.safeParse({ alvoId: empresaId });
    if (!parsed.success) throw new ErroDeNegocio("Empresa não encontrada.");
    await exigirSenhaDoAdmin(admin.usuarioId, senha);
    await prisma.$transaction(async (tx) => {
      const agora = new Date().toISOString();
      const atualizadas = await tx.empresa.updateMany({
        where: { id: parsed.data.alvoId, bloqueadaEm: { not: null } },
        data: { bloqueadaEm: null, bloqueioMotivo: null, atualizadoEm: agora },
      });
      if (atualizadas.count === 0) throw new ErroDeNegocio("Esta empresa não está bloqueada.");
      await registrarLogAdmin(tx, admin.usuarioId, "empresa.desbloquear", "Empresa", parsed.data.alvoId, {});
    });
    return null;
  });
}

/** Troca o plano. "teste" começa um período novo (duração da configuração da plataforma); os demais planos não têm data de fim. */
export async function alterarPlanoEmpresa(empresaId: string, plano: string, motivo: string, senha?: string): Promise<ResultadoAction<null>> {
  const admin = await exigirAdminAction();
  return executar(async () => {
    const parsed = alterarPlanoSchema.safeParse({ empresaId, plano, motivo });
    if (!parsed.success) throw new ErroDeNegocio(parsed.error.issues[0]?.message ?? "Dados inválidos.");
    await exigirSenhaDoAdmin(admin.usuarioId, senha);
    await prisma.$transaction(async (tx) => {
      const empresa = await tx.empresa.findUnique({ where: { id: parsed.data.empresaId }, select: { id: true, plano: true, testeTerminaEm: true } });
      if (!empresa) throw new ErroDeNegocio("Empresa não encontrada.");
      if (empresa.plano === parsed.data.plano) throw new ErroDeNegocio("A empresa já está neste plano.");
      const agora = new Date().toISOString();
      const fim = parsed.data.plano === "teste" ? calcularFimDoTeste((await obterConfigCiclo()).testeDias) : null;
      // O plano lido entra no where: dois admins trocando ao mesmo tempo não gravam um "de" errado no log.
      const trocadas = await tx.empresa.updateMany({
        where: { id: empresa.id, plano: empresa.plano },
        data: { plano: parsed.data.plano, testeTerminaEm: fim, atualizadoEm: agora },
      });
      if (trocadas.count === 0) throw new ErroDeNegocio("O plano mudou em outra aba. Recarregue a página.");
      if (fim) await registrarEvento(tx, { tipo: "teste_iniciado", empresaId: empresa.id, usuarioId: admin.usuarioId, chave: `teste:${empresa.id}:${fim}`, dados: { origem: "admin" } });
      await registrarLogAdmin(tx, admin.usuarioId, "empresa.alterar_plano", "Empresa", empresa.id, {
        de: empresa.plano,
        para: parsed.data.plano,
        testeTerminaEm: fim,
        motivo: parsed.data.motivo,
      });
    });
    return null;
  });
}
