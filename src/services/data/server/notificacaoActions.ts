"use server";

import { exigirSessaoAction } from "@/lib/auth/dal";
import type { NotificacaoItem } from "@/types";
import * as core from "./notificacaoCore.server";

// Notificações valem para qualquer plano, então usam o guard de sessão, não o de um recurso. A regra de quem vê o
// quê (empresa x destinatário individual) fica em notificacaoCore.server.ts.

export async function listarNotificacoes(): Promise<NotificacaoItem[]> {
  const sessao = await exigirSessaoAction();
  return core.listar(sessao);
}

export async function contarNotificacoesNaoLidas(): Promise<number> {
  const sessao = await exigirSessaoAction();
  return core.contarNaoLidas(sessao);
}

export async function marcarNotificacaoLida(id: string): Promise<void> {
  const sessao = await exigirSessaoAction();
  await core.marcarLida(sessao, id);
}

export async function marcarTodasNotificacoesLidas(): Promise<void> {
  const sessao = await exigirSessaoAction();
  await core.marcarTodasLidas(sessao);
}
