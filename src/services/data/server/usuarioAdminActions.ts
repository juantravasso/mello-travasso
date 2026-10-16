"use server";

import { prisma } from "@/lib/prisma";
import { exigirAdminAction } from "@/lib/auth/dal";
import { alvoSchema, bloquearSchema, buscaAdminSchema } from "@/lib/validacao/admin";
import type { ResultadoAction, UsuarioAdminItem } from "@/types";
import { registrarLogAdmin } from "./adminLog.server";
import { nomeParaAdmin } from "./avaliacaoCore.server";
import { exigirSenhaDoAdmin } from "./reautenticacao.server";
import { ErroDeNegocio, executar } from "./resultado.server";

/** Usuários, mais recentes primeiro, com busca por nome ou e-mail. */
export async function listarUsuariosAdmin(busca?: string): Promise<UsuarioAdminItem[]> {
  const admin = await exigirAdminAction();
  const parsed = buscaAdminSchema.safeParse(busca ?? "");
  const termo = parsed.success ? parsed.data.replace(/[%_\\]/g, " ").trim() : "";
  const usuarios = await prisma.usuario.findMany({
    where: termo
      ? { OR: [{ nome: { contains: termo, mode: "insensitive" } }, { email: { contains: termo.toLowerCase() } }] }
      : {},
    include: {
      empresa: { select: { id: true, tipoPessoa: true, nomeFantasia: true, razaoSocial: true, bloqueadaEm: true } },
    },
    orderBy: [{ criadoEm: "desc" }, { id: "asc" }],
    take: 50,
  });
  return usuarios.map((u) => ({
    id: u.id,
    nome: u.nome,
    email: u.email,
    empresaId: u.empresaId,
    empresaNome: nomeParaAdmin(u.empresa),
    papel: u.papel,
    admin: u.papelPlataforma === "admin",
    emailConfirmado: u.emailConfirmadoEm !== null,
    bloqueadoEm: u.bloqueadoPlataformaEm ?? undefined,
    empresaBloqueada: u.empresa.bloqueadaEm !== null,
    criadoEm: u.criadoEm,
    proprio: u.id === admin.usuarioId,
  }));
}

/** Bloqueia um usuário (as sessões dele caem na hora). Não vale para si mesmo nem para outro administrador. */
export async function bloquearUsuario(usuarioId: string, motivo: string, senha?: string): Promise<ResultadoAction<null>> {
  const admin = await exigirAdminAction();
  return executar(async () => {
    const parsed = bloquearSchema.safeParse({ alvoId: usuarioId, motivo });
    if (!parsed.success) throw new ErroDeNegocio(parsed.error.issues[0]?.message ?? "Dados inválidos.");
    await exigirSenhaDoAdmin(admin.usuarioId, senha);
    if (parsed.data.alvoId === admin.usuarioId) throw new ErroDeNegocio("Você não pode bloquear a si mesmo.");

    await prisma.$transaction(async (tx) => {
      const alvo = await tx.usuario.findUnique({ where: { id: parsed.data.alvoId }, select: { id: true, papelPlataforma: true } });
      if (!alvo) throw new ErroDeNegocio("Usuário não encontrado.");
      if (alvo.papelPlataforma === "admin") {
        throw new ErroDeNegocio("Este usuário é administrador da plataforma. Retire o papel antes (yarn admin:promover --remover).");
      }
      const agora = new Date().toISOString();
      const atualizados = await tx.usuario.updateMany({
        where: { id: alvo.id, bloqueadoPlataformaEm: null },
        data: { bloqueadoPlataformaEm: agora, bloqueioPlataformaMotivo: parsed.data.motivo, atualizadoEm: agora },
      });
      if (atualizados.count === 0) throw new ErroDeNegocio("Este usuário já está bloqueado.");
      const sessoes = await tx.sessao.deleteMany({ where: { usuarioId: alvo.id } });
      await registrarLogAdmin(tx, admin.usuarioId, "usuario.bloquear", "Usuario", alvo.id, {
        motivo: parsed.data.motivo,
        sessoesEncerradas: sessoes.count,
      });
    });
    return null;
  });
}

export async function desbloquearUsuario(usuarioId: string, senha?: string): Promise<ResultadoAction<null>> {
  const admin = await exigirAdminAction();
  return executar(async () => {
    const parsed = alvoSchema.safeParse({ alvoId: usuarioId });
    if (!parsed.success) throw new ErroDeNegocio("Usuário não encontrado.");
    await exigirSenhaDoAdmin(admin.usuarioId, senha);
    await prisma.$transaction(async (tx) => {
      const agora = new Date().toISOString();
      const atualizados = await tx.usuario.updateMany({
        where: { id: parsed.data.alvoId, bloqueadoPlataformaEm: { not: null } },
        data: { bloqueadoPlataformaEm: null, bloqueioPlataformaMotivo: null, atualizadoEm: agora },
      });
      if (atualizados.count === 0) throw new ErroDeNegocio("Este usuário não está bloqueado.");
      await registrarLogAdmin(tx, admin.usuarioId, "usuario.desbloquear", "Usuario", parsed.data.alvoId, {});
    });
    return null;
  });
}

/** Encerra todas as sessões abertas do usuário (ex.: suspeita de sessão roubada), sem bloquear a conta. */
export async function encerrarSessoesDoUsuario(usuarioId: string, senha?: string): Promise<ResultadoAction<null>> {
  const admin = await exigirAdminAction();
  return executar(async () => {
    const parsed = alvoSchema.safeParse({ alvoId: usuarioId });
    if (!parsed.success) throw new ErroDeNegocio("Usuário não encontrado.");
    await exigirSenhaDoAdmin(admin.usuarioId, senha);
    await prisma.$transaction(async (tx) => {
      const existe = await tx.usuario.findUnique({ where: { id: parsed.data.alvoId }, select: { id: true } });
      if (!existe) throw new ErroDeNegocio("Usuário não encontrado.");
      const sessoes = await tx.sessao.deleteMany({ where: { usuarioId: existe.id } });
      await registrarLogAdmin(tx, admin.usuarioId, "usuario.encerrar_sessoes", "Usuario", existe.id, { sessoesEncerradas: sessoes.count });
    });
    return null;
  });
}
