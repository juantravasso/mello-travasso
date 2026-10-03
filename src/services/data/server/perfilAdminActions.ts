"use server";

import { prisma } from "@/lib/prisma";
import { exigirAdminAction } from "@/lib/auth/dal";
import { suspenderPerfilSchema } from "@/lib/validacao/rede";
import { normalizarBusca } from "@/lib/rede/texto";
import type { PerfilAdminItem, ResultadoAction } from "@/types";
import { registrarLogAdmin } from "./adminLog.server";
import { aplicarSuspensaoPerfil } from "./moderacaoCore.server";
import { exigirSenhaDoAdmin } from "./reautenticacao.server";
import { ErroDeNegocio, executar } from "./resultado.server";

/** Perfis publicados, indicados ou suspensos (rascunhos são privados do dono), com busca por nome ou endereço. */
export async function listarPerfisAdmin(busca?: string): Promise<PerfilAdminItem[]> {
  await exigirAdminAction();
  const termo = typeof busca === "string" ? normalizarBusca(busca).replace(/[%_\\]/g, " ").trim().slice(0, 80) : "";
  const perfis = await prisma.perfilPublico.findMany({
    where: {
      status: { in: ["publicado", "indicado", "suspenso"] },
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
export async function suspenderPerfil(slug: string, motivo: string, senha?: string): Promise<ResultadoAction<null>> {
  const admin = await exigirAdminAction();
  return executar(async () => {
    const parsed = suspenderPerfilSchema.safeParse({ slug, motivo });
    if (!parsed.success) throw new ErroDeNegocio(parsed.error.issues[0]?.message ?? "Dados inválidos.");
    await exigirSenhaDoAdmin(admin.usuarioId, senha);

    await prisma.$transaction(async (tx) => {
      const perfil = await tx.perfilPublico.findUnique({ where: { slug: parsed.data.slug }, select: { id: true } });
      if (!perfil) throw new ErroDeNegocio("Perfil não encontrado.");
      await aplicarSuspensaoPerfil(tx, admin.usuarioId, perfil.id, parsed.data.motivo);
    });
    return null;
  });
}

/** Tira o perfil da suspensão. */
export async function reativarPerfil(slug: string, senha?: string): Promise<ResultadoAction<null>> {
  const admin = await exigirAdminAction();
  return executar(async () => {
    await exigirSenhaDoAdmin(admin.usuarioId, senha);
    if (typeof slug !== "string" || !/^[a-z0-9-]{1,80}$/.test(slug)) throw new ErroDeNegocio("Perfil não encontrado.");
    await prisma.$transaction(async (tx) => {
      const perfil = await tx.perfilPublico.findUnique({ where: { slug }, select: { id: true, empresaId: true } });
      if (!perfil) throw new ErroDeNegocio("Perfil não encontrado.");
      // Perfil com dono volta como rascunho (ele republica); perfil indicado, que
      // não tem dono, volta a ser público como indicado.
      const atualizados = await tx.perfilPublico.updateMany({
        where: { id: perfil.id, status: "suspenso" },
        data: { status: perfil.empresaId ? "rascunho" : "indicado", atualizadoEm: new Date().toISOString() },
      });
      if (atualizados.count === 0) throw new ErroDeNegocio("Este perfil não está suspenso.");
      await registrarLogAdmin(tx, admin.usuarioId, "perfil.reativar", "PerfilPublico", perfil.id, { slug });
    });
    return null;
  });
}
