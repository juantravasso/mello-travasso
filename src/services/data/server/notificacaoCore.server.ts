import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { NotificacaoItem } from "@/types";
import type { Contexto } from "./calendarioCore.server";

// Notificações do usuário: as da empresa (usuarioId nulo, vistas por todos) e as endereçadas a ele (lembretes do
// calendário). As de outro usuário nunca entram, nem por listagem, contagem ou marcação como lida.

function doUsuario(ctx: Contexto): Prisma.NotificacaoWhereInput {
  return { empresaId: ctx.empresaId, OR: [{ usuarioId: null }, { usuarioId: ctx.usuarioId }] };
}

export async function listar(ctx: Contexto): Promise<NotificacaoItem[]> {
  // Retenção: limpeza oportunista (não é um job agendado) do que tem mais de 90 dias e já foi lido ou é da empresa.
  if (Math.random() < 0.05) {
    const corte = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    await prisma.notificacao.deleteMany({ where: { ...doUsuario(ctx), criadoEm: { lt: corte } } });
  }
  const registros = await prisma.notificacao.findMany({
    where: doUsuario(ctx),
    orderBy: [{ criadoEm: "desc" }, { id: "asc" }],
    take: 50,
  });
  return registros.map((n) => ({
    id: n.id,
    tipo: n.tipo,
    titulo: n.titulo ?? undefined,
    texto: n.texto,
    href: n.href,
    lida: n.lida,
    criadoEm: n.criadoEm,
    compromissoId: n.compromissoId ?? undefined,
  }));
}

export async function contarNaoLidas(ctx: Contexto): Promise<number> {
  return prisma.notificacao.count({ where: { ...doUsuario(ctx), lida: false } });
}

/** Marca uma notificação lida; um identificador de outro usuário não encontra nada (e não avisa que existe). */
export async function marcarLida(ctx: Contexto, id: string): Promise<void> {
  if (typeof id !== "string" || id.length > 64) return;
  await prisma.notificacao.updateMany({ where: { ...doUsuario(ctx), id }, data: { lida: true } });
}

export async function marcarTodasLidas(ctx: Contexto): Promise<void> {
  await prisma.notificacao.updateMany({ where: { ...doUsuario(ctx), lida: false }, data: { lida: true } });
}
