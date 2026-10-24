"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { exigirAdminAction } from "@/lib/auth/dal";
import { normalizarBusca } from "@/lib/rede/texto";
import type { RecomendacaoAdminItem, ResumoAdmin, ResultadoAction, TrabalhoAdminItem } from "@/types";
import { registrarLogAdmin } from "./adminLog.server";
import { excluirArquivos } from "./armazenamento.server";
import { nomePublicoDaEmpresa, selecaoEmpresaParaNome } from "./avaliacaoCore.server";
import { exigirSenhaDoAdmin } from "./reautenticacao.server";
import { ErroDeNegocio, executar } from "./resultado.server";

// Controle de conteúdo da rede pela administração: o resumo da página inicial e a moderação de recomendações e do
// portfólio. Tudo exige administrador; remover pede a senha de novo e um motivo, e entra no registro de ações.

const STATUS_DENUNCIA_ABERTA = ["aberta", "em_analise", "aguardando_informacoes"] as const;

export async function obterResumoAdmin(): Promise<ResumoAdmin> {
  await exigirAdminAction();
  const agora = new Date().toISOString();
  const [total, emTeste, ativas, gratuitas, bloqueadas, usuarios, perfisPublicados, avaliacoes, recomendacoes, trabalhos, denunciasAbertas, assinaturasAtivas] = await Promise.all([
    prisma.empresa.count(),
    prisma.empresa.count({ where: { plano: "teste", testeTerminaEm: { gte: agora } } }),
    prisma.empresa.count({ where: { plano: "ativo" } }),
    prisma.empresa.count({ where: { plano: "gratuito" } }),
    prisma.empresa.count({ where: { bloqueadaEm: { not: null } } }),
    prisma.usuario.count(),
    prisma.perfilPublico.count({ where: { status: "publicado" } }),
    prisma.avaliacao.count({ where: { status: "publicada" } }),
    prisma.indicacao.count(),
    prisma.trabalho.count(),
    prisma.denuncia.count({ where: { status: { in: [...STATUS_DENUNCIA_ABERTA] } } }),
    prisma.assinaturaComercial.findMany({ where: { status: "ativa" }, select: { ciclo: true, valorCentavos: true } }),
  ]);
  const receitaMensalCentavos = assinaturasAtivas.reduce((soma, a) => soma + (a.ciclo === "anual" ? Math.round(a.valorCentavos / 12) : a.valorCentavos), 0);
  return {
    empresas: { total, emTeste, ativas, gratuitas, bloqueadas },
    usuarios,
    perfisPublicados,
    avaliacoes,
    recomendacoes,
    trabalhos,
    denunciasAbertas,
    assinaturas: { ativas: assinaturasAtivas.length, receitaMensalCentavos },
  };
}

function termoDeBusca(busca?: string): string {
  return typeof busca === "string" ? normalizarBusca(busca).replace(/[%_\\]/g, " ").trim().slice(0, 80) : "";
}

const removerSchema = z.object({ id: z.string().uuid(), motivo: z.string().trim().min(5, "Descreva o motivo (mínimo 5 letras).").max(500) }).strict();

// ---------------------------------------------------------------- recomendações

export async function listarRecomendacoesAdmin(busca?: string): Promise<RecomendacaoAdminItem[]> {
  await exigirAdminAction();
  const termo = termoDeBusca(busca);
  const registros = await prisma.indicacao.findMany({
    where: termo ? { perfil: { nomeBusca: { contains: termo } } } : {},
    include: { perfil: { select: { slug: true, nome: true } }, indicadoPor: { select: selecaoEmpresaParaNome } },
    orderBy: [{ criadoEm: "desc" }, { id: "asc" }],
    take: 50,
  });
  return registros.map((r) => ({
    id: r.id,
    criadoEm: r.criadoEm,
    perfilSlug: r.perfil.slug,
    perfilNome: r.perfil.nome,
    recomendadoPorNome: nomePublicoDaEmpresa(r.indicadoPor).nome,
  }));
}

/** Remove a recomendação (some da contagem do perfil). O log guarda quem recomendou quem e o motivo. */
export async function removerRecomendacaoAdmin(id: string, motivo: string, senha?: string): Promise<ResultadoAction<null>> {
  const admin = await exigirAdminAction();
  return executar(async () => {
    const parsed = removerSchema.safeParse({ id, motivo });
    if (!parsed.success) throw new ErroDeNegocio(parsed.error.issues[0]?.message ?? "Dados inválidos.");
    await exigirSenhaDoAdmin(admin.usuarioId, senha);
    await prisma.$transaction(async (tx) => {
      const r = await tx.indicacao.findUnique({ where: { id: parsed.data.id }, select: { id: true, perfilId: true, indicadoPorEmpresaId: true } });
      if (!r) throw new ErroDeNegocio("Recomendação não encontrada.");
      await tx.indicacao.delete({ where: { id: r.id } });
      await registrarLogAdmin(tx, admin.usuarioId, "indicacao.remover", "Indicacao", r.id, { perfilId: r.perfilId, indicadoPorEmpresaId: r.indicadoPorEmpresaId, motivo: parsed.data.motivo });
    });
    return null;
  });
}

// ---------------------------------------------------------------- portfólio

export async function listarTrabalhosAdmin(busca?: string): Promise<TrabalhoAdminItem[]> {
  await exigirAdminAction();
  const termo = termoDeBusca(busca);
  const registros = await prisma.trabalho.findMany({
    where: termo ? { OR: [{ perfil: { nomeBusca: { contains: termo } } }, { titulo: { contains: termo, mode: "insensitive" } }] } : {},
    include: { perfil: { select: { slug: true, nome: true } }, _count: { select: { fotos: true } } },
    orderBy: [{ criadoEm: "desc" }, { id: "asc" }],
    take: 50,
  });
  return registros.map((t) => ({
    id: t.id,
    titulo: t.titulo,
    descricao: t.descricao ?? undefined,
    criadoEm: t.criadoEm,
    fotos: t._count.fotos,
    perfilSlug: t.perfil.slug,
    perfilNome: t.perfil.nome,
  }));
}

/**
 * Remove um trabalho do portfólio (e as fotos dele). A empresa é avisada na central de notificações, sem o motivo, que
 * é interno; o log guarda título e motivo.
 */
export async function removerTrabalhoAdmin(id: string, motivo: string, senha?: string): Promise<ResultadoAction<null>> {
  const admin = await exigirAdminAction();
  return executar(async () => {
    const parsed = removerSchema.safeParse({ id, motivo });
    if (!parsed.success) throw new ErroDeNegocio(parsed.error.issues[0]?.message ?? "Dados inválidos.");
    await exigirSenhaDoAdmin(admin.usuarioId, senha);
    await prisma.$transaction(async (tx) => {
      const t = await tx.trabalho.findUnique({
        where: { id: parsed.data.id },
        select: { id: true, titulo: true, perfilId: true, perfil: { select: { empresaId: true } }, fotos: { select: { arquivoId: true } } },
      });
      if (!t) throw new ErroDeNegocio("Trabalho não encontrado.");
      const empresaId = t.perfil.empresaId;
      if (empresaId) await excluirArquivos(tx, t.fotos.map((f) => f.arquivoId), empresaId);
      await tx.trabalho.delete({ where: { id: t.id } });
      if (empresaId) {
        await tx.notificacao.create({
          data: {
            empresaId,
            tipo: "moderacao",
            texto: `O trabalho “${t.titulo}” foi removido do seu portfólio pela administração.`,
            href: "/minha-rede/portfolio",
            criadoEm: new Date().toISOString(),
          },
        });
      }
      await registrarLogAdmin(tx, admin.usuarioId, "trabalho.remover", "Trabalho", t.id, { perfilId: t.perfilId, titulo: t.titulo, fotos: t.fotos.length, motivo: parsed.data.motivo });
    });
    return null;
  });
}
