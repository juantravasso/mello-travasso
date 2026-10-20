"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirSessaoAction } from "@/lib/auth/dal";
import { extrairIpConfiavel, verificarLimite } from "@/lib/auth/limite";
import type { ResultadoAction } from "@/types";
import { consumirTokenDeConfirmacao, emitirConfirmacaoDeEmail } from "./emailConfirmacao.server";
import { processarCicloDeVida } from "./cicloDeVidaCore.server";
import { ErroDeNegocio, executar } from "./resultado.server";

const UM_MINUTO_MS = 60 * 1000;
const UMA_HORA_MS = 60 * 60 * 1000;
const UM_DIA_MS = 24 * UMA_HORA_MS;

const tokenSchema = z.string().min(20).max(100).regex(/^[A-Za-z0-9_-]+$/);

/** Reenvia o link de confirmação para o e-mail da conta logada. */
export async function reenviarConfirmacaoEmail(): Promise<ResultadoAction<null>> {
  const sessao = await exigirSessaoAction();
  return executar(async () => {
    const usuario = await prisma.usuario.findUniqueOrThrow({
      where: { id: sessao.usuarioId },
      select: { id: true, nome: true, email: true, emailConfirmadoEm: true },
    });
    if (usuario.emailConfirmadoEm) return null;

    // Três tetos: o intervalo curto evita rajada, o diário limita o custo de envio
    // e o por IP impede usar o recurso para encher caixas de e-mail alheias.
    const intervalo = await verificarLimite(`email-reenvio-min:${usuario.id}`, 1, UM_MINUTO_MS);
    if (!intervalo.permitido) throw new ErroDeNegocio("Aguarde um minuto para pedir outro e-mail.");
    const dia = await verificarLimite(`email-reenvio-dia:${usuario.id}`, 5, UM_DIA_MS);
    if (!dia.permitido) throw new ErroDeNegocio("Você já pediu muitos e-mails hoje. Tente de novo amanhã.");
    // IP desconhecido (sem x-forwarded-for) não entra no balde por IP: viraria um teto global de 20 por dia.
    const endereco = extrairIpConfiavel(await headers());
    if (endereco !== "desconhecido") {
      const ip = await verificarLimite(`email-reenvio-ip:${endereco}`, 20, UM_DIA_MS);
      if (!ip.permitido) throw new ErroDeNegocio("Muitos pedidos a partir desta rede hoje. Tente de novo amanhã.");
    }

    const enviado = await emitirConfirmacaoDeEmail(usuario);
    if (!enviado) throw new ErroDeNegocio("Não foi possível enviar o e-mail agora. Tente de novo em alguns minutos.");
    return null;
  });
}

/**
 * Confirma o e-mail a partir do token do link. Não exige sessão: o token prova
 * que quem clicou controla a caixa de entrada. Resposta única para token
 * inexistente, vencido ou já usado.
 */
export async function confirmarEmail(token: unknown): Promise<ResultadoAction<null>> {
  return executar(async () => {
    const parsed = tokenSchema.safeParse(token);
    if (!parsed.success) throw new ErroDeNegocio("Este link não é válido ou já venceu. Peça um novo e-mail de confirmação.");
    const ip = await verificarLimite(`email-confirmar-ip:${extrairIpConfiavel(await headers())}`, 30, UMA_HORA_MS);
    if (!ip.permitido) throw new ErroDeNegocio("Muitas tentativas. Tente de novo mais tarde.");

    const resultado = await consumirTokenDeConfirmacao(parsed.data);
    if (resultado !== "confirmado") {
      throw new ErroDeNegocio("Este link não é válido ou já venceu. Peça um novo e-mail de confirmação.");
    }
    // A boas-vindas sai logo depois da confirmação, sem esperar o agendador (que também a enviaria, se isto falhar).
    after(() =>
      processarCicloDeVida({ somenteEnvio: true, limiteEnvio: 5 }).catch((e) => {
        console.error("[email] falha ao enviar a boas-vindas:", e instanceof Error ? e.name : "erro");
      }),
    );
    return null;
  });
}
