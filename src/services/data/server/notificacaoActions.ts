"use server";

import { prisma } from "@/lib/prisma";
import { exigirSessaoAction } from "@/lib/auth/dal";
import type { NotificacaoItem } from "@/types";

// Notificações são da empresa (todos os usuários dela veem as mesmas) e valem
// para qualquer plano, então usam o guard de sessão, não o de um recurso.

export async function listarNotificacoes(): Promise<NotificacaoItem[]> {
  const sessao = await exigirSessaoAction();
  // Retenção: limpeza oportunista (não é um job agendado) das notificações com mais de 90 dias.
  if (Math.random() < 0.05) {
    const corte = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    await prisma.notificacao.deleteMany({ where: { empresaId: sessao.empresaId, criadoEm: { lt: corte } } });
  }
  const registros = await prisma.notificacao.findMany({
    where: { empresaId: sessao.empresaId },
    orderBy: [{ criadoEm: "desc" }, { id: "asc" }],
    take: 50,
  });
  return registros.map((n) => ({ id: n.id, tipo: n.tipo, texto: n.texto, href: n.href, lida: n.lida, criadoEm: n.criadoEm }));
}

export async function contarNotificacoesNaoLidas(): Promise<number> {
  const sessao = await exigirSessaoAction();
  return prisma.notificacao.count({ where: { empresaId: sessao.empresaId, lida: false } });
}

export async function marcarNotificacaoLida(id: string): Promise<void> {
  const sessao = await exigirSessaoAction();
  if (typeof id !== "string" || id.length > 64) return;
  await prisma.notificacao.updateMany({ where: { id, empresaId: sessao.empresaId }, data: { lida: true } });
}

export async function marcarTodasNotificacoesLidas(): Promise<void> {
  const sessao = await exigirSessaoAction();
  await prisma.notificacao.updateMany({ where: { empresaId: sessao.empresaId, lida: false }, data: { lida: true } });
}
