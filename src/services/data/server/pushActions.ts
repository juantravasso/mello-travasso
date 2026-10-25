"use server";

import { z } from "zod";
import { exigirSessaoAction } from "@/lib/auth/dal";
import { verificarLimite } from "@/lib/auth/limite";
import { pushConfigurado } from "@/lib/push/enviar.server";
import type { ResultadoAction } from "@/types";
import * as core from "./pushCore.server";
import { ErroDeNegocio, executar } from "./resultado.server";

// Server Actions das notificações push. A pessoa vem da SESSÃO; o aparelho (endpoint e chaves) vem do navegador e é
// validado aqui. As regras estão em pushCore.server.ts.

const UMA_HORA_MS = 60 * 60 * 1000;

const inscricaoSchema = z
  .object({
    endpoint: z.string().url().max(2048).startsWith("https://"),
    p256dh: z.string().min(1).max(256),
    auth: z.string().min(1).max(64),
  })
  .strict();

const removerSchema = z.object({ endpoint: z.string().url().max(2048) }).strict();

export interface EstadoPush {
  /** O servidor tem as chaves VAPID. Sem isso o botão nem aparece. */
  disponivel: boolean;
}

export async function obterEstadoPush(): Promise<ResultadoAction<EstadoPush>> {
  return executar(async () => {
    await exigirSessaoAction();
    return { disponivel: pushConfigurado() };
  });
}

export async function salvarInscricaoPush(entrada: { endpoint: string; p256dh: string; auth: string }): Promise<ResultadoAction<null>> {
  return executar(async () => {
    const sessao = await exigirSessaoAction();
    if (!pushConfigurado()) throw new ErroDeNegocio("Notificações push ainda não estão disponíveis.");
    const limite = await verificarLimite(`push-inscricao:${sessao.usuarioId}`, 60, UMA_HORA_MS);
    if (!limite.permitido) throw new ErroDeNegocio("Muitas tentativas. Tente de novo em alguns minutos.");
    const parsed = inscricaoSchema.safeParse(entrada);
    if (!parsed.success) throw new ErroDeNegocio("Não foi possível registrar este aparelho.");
    await core.salvarInscricao(sessao.usuarioId, parsed.data);
    return null;
  });
}

export async function removerInscricaoPush(entrada: { endpoint: string }): Promise<ResultadoAction<null>> {
  return executar(async () => {
    const sessao = await exigirSessaoAction();
    const parsed = removerSchema.safeParse(entrada);
    if (!parsed.success) throw new ErroDeNegocio("Aparelho inválido.");
    await core.removerInscricao(sessao.usuarioId, parsed.data.endpoint);
    return null;
  });
}
