"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { after } from "next/server";
import { createHash } from "node:crypto";
import { extrairIpConfiavel, limparLimitesExpirados, verificarLimite } from "@/lib/auth/limite";
import { emailSchema, senhaSchema } from "@/lib/validacao/auth";
import type { ResultadoAction } from "@/types";
import { enviarLinkDeRedefinicao, redefinirSenhaComToken } from "./redefinicaoSenha.server";
import { ErroDeNegocio, executar } from "./resultado.server";

const UM_MINUTO_MS = 60 * 1000;
const UMA_HORA_MS = 60 * 60 * 1000;
const UM_DIA_MS = 24 * UMA_HORA_MS;

const solicitarSchema = z.object({ email: emailSchema }).strict();
const redefinirSchema = z
  .object({
    token: z.string().min(20).max(100).regex(/^[A-Za-z0-9_-]+$/),
    senhaNova: senhaSchema,
  })
  .strict();

const MENSAGEM_LINK_INVALIDO = "Este link não é válido ou já venceu. Peça uma nova redefinição de senha.";

/**
 * Pede o link de redefinição. A resposta é a mesma exista a conta ou não, e o
 * envio acontece depois dela (after), então nem o texto nem o tempo revelam se
 * o e-mail tem cadastro. Os tetos por IP e por e-mail valem para todos.
 */
export async function solicitarRedefinicaoDeSenha(input: unknown): Promise<ResultadoAction<null>> {
  return executar(async () => {
    const parsed = solicitarSchema.safeParse(input);
    if (!parsed.success) throw new ErroDeNegocio("Informe um e-mail válido.");
    const { email } = parsed.data;

    const ip = extrairIpConfiavel(await headers());
    // IP desconhecido não entra no balde por IP: viraria um teto global compartilhado.
    if (ip !== "desconhecido") {
      const porIp = await verificarLimite(`senha-pedido-ip:${ip}`, 10, UMA_HORA_MS);
      if (!porIp.permitido) throw new ErroDeNegocio("Muitos pedidos a partir desta rede. Tente de novo mais tarde.");
    }
    // Tetos por e-mail (a chave é um hash). Valem para qualquer endereço, exista conta ou não, então as
    // mensagens não são oráculo. O intervalo e o teto diário também limitam o bombardeio de uma caixa alheia.
    const chaveEmail = createHash("sha256").update(email).digest("hex");
    const intervalo = await verificarLimite(`senha-pedido-email-min:${chaveEmail}`, 1, UM_MINUTO_MS);
    if (!intervalo.permitido) throw new ErroDeNegocio("Aguarde um minuto para pedir outro link.");
    const porEmail = await verificarLimite(`senha-pedido-email:${chaveEmail}`, 3, UMA_HORA_MS);
    if (!porEmail.permitido) throw new ErroDeNegocio("Muitos pedidos para este e-mail. Tente de novo em uma hora.");
    const porEmailDia = await verificarLimite(`senha-pedido-email-dia:${chaveEmail}`, 6, UM_DIA_MS);
    if (!porEmailDia.permitido) throw new ErroDeNegocio("Muitos pedidos para este e-mail hoje. Tente de novo amanhã.");
    // Cada pedido cria linhas de limite, mesmo para e-mails sem conta: limpeza oportunista.
    if (Math.random() < 0.02) await limparLimitesExpirados().catch(() => undefined);

    after(() =>
      enviarLinkDeRedefinicao(email).catch((e) => {
        console.error("[senha] falha ao enviar link de redefinição:", e instanceof Error ? e.name : "erro");
      }),
    );
    return null;
  });
}

/** Grava a senha nova a partir do link. Não exige sessão: o token prova o controle da caixa de entrada. */
export async function redefinirSenha(input: unknown): Promise<ResultadoAction<null>> {
  return executar(async () => {
    const parsed = redefinirSchema.safeParse(input);
    if (!parsed.success) {
      const campo = parsed.error.issues.find((i) => i.path[0] === "senhaNova");
      throw new ErroDeNegocio(campo?.message ?? MENSAGEM_LINK_INVALIDO);
    }
    const ip = extrairIpConfiavel(await headers());
    if (ip !== "desconhecido") {
      const porIp = await verificarLimite(`senha-redefinir-ip:${ip}`, 20, UMA_HORA_MS);
      if (!porIp.permitido) throw new ErroDeNegocio("Muitas tentativas. Tente de novo mais tarde.");
    }
    const resultado = await redefinirSenhaComToken(parsed.data.token, parsed.data.senhaNova);
    if (resultado !== "redefinida") throw new ErroDeNegocio(MENSAGEM_LINK_INVALIDO);
    return null;
  });
}
