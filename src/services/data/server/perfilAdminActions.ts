"use server";

import { prisma } from "@/lib/prisma";
import { exigirAdminAction } from "@/lib/auth/dal";
import { suspenderPerfilSchema } from "@/lib/validacao/rede";
import { normalizarBusca } from "@/lib/rede/texto";
import type { PerfilAdminItem, ResultadoAction } from "@/types";
import { registrarLogAdmin } from "./adminLog.server";
import { ErroDeNegocio, executar } from "./resultado.server";

/** Perfis publicados ou suspensos (rascunhos são privados do dono), com busca por nome ou endereço. */
export async function listarPerfisAdmin(busca?: string): Promise<PerfilAdminItem[]> {
  await exigirAdminAction();
  const termo = typeof busca === "string" ? normalizarBusca(busca).replace(/[%_\\]/g, " ").trim().slice(0, 80) : "";
  const perfis = await prisma.perfilPublico.findMany({
    where: {
      status: { in: ["publicado", "suspenso"] },
      ...(termo ? { OR: [{ nomeBusca: { contains: termo } }, { slug: { contains: termo.replace(/\s+/g, "-") } }] } : {}),
    },
    orderBy: [{ atualizadoEm: "desc" }, { id: "asc" }],
    take: 50,
  });
  return perfis.map((p) => ({
    slug: p.slug,
    tipo: p.tipo,
    status: p.status,
    nome: p.nome,
    cidade: p.cidade ?? undefined,
    estado: p.estado ?? undefined,
    atualizadoEm: p.atualizadoEm,
  }));
}

/** Derruba um perfil da rede. O dono não consegue republicar; só a administração reativa. */
export async function suspenderPerfil(slug: string, motivo: string): Promise<ResultadoAction<null>> {
  const admin = await exigirAdminAction();
  return executar(async () => {
    const parsed = suspenderPerfilSchema.safeParse({ slug, motivo });
    if (!parsed.success) throw new ErroDeNegocio(parsed.error.issues[0]?.message ?? "Dados inválidos.");

    await prisma.$transaction(async (tx) => {
      const perfil = await tx.perfilPublico.findUnique({ where: { slug: parsed.data.slug }, select: { id: true, status: true } });
      if (!perfil) throw new ErroDeNegocio("Perfil não encontrado.");
      const atualizados = await tx.perfilPublico.updateMany({
        where: { id: perfil.id, status: { not: "suspenso" } },
        data: { status: "suspenso", atualizadoEm: new Date().toISOString() },
      });
      if (atualizados.count === 0) throw new ErroDeNegocio("Este perfil já está suspenso.");
      await registrarLogAdmin(tx, admin.usuarioId, "perfil.suspender", "PerfilPublico", perfil.id, {
        slug: parsed.data.slug,
        statusAnterior: perfil.status,
        motivo: parsed.data.motivo,
      });
    });
    return null;
  });
}

/** Tira o perfil da suspensão. Volta como rascunho: o dono republica quando quiser. */
export async function reativarPerfil(slug: string): Promise<ResultadoAction<null>> {
  const admin = await exigirAdminAction();
  return executar(async () => {
    if (typeof slug !== "string" || !/^[a-z0-9-]{1,80}$/.test(slug)) throw new ErroDeNegocio("Perfil não encontrado.");
    await prisma.$transaction(async (tx) => {
      const perfil = await tx.perfilPublico.findUnique({ where: { slug }, select: { id: true } });
      if (!perfil) throw new ErroDeNegocio("Perfil não encontrado.");
      const atualizados = await tx.perfilPublico.updateMany({
        where: { id: perfil.id, status: "suspenso" },
        data: { status: "rascunho", atualizadoEm: new Date().toISOString() },
      });
      if (atualizados.count === 0) throw new ErroDeNegocio("Este perfil não está suspenso.");
      await registrarLogAdmin(tx, admin.usuarioId, "perfil.reativar", "PerfilPublico", perfil.id, { slug });
    });
    return null;
  });
}
