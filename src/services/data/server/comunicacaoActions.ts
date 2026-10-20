"use server";

import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { exigirSessaoAction } from "@/lib/auth/dal";
import { extrairIpConfiavel, verificarLimite } from "@/lib/auth/limite";
import type { PreferenciaComunicacao, ResultadoAction } from "@/types";
import { definirEmailsPromocionais, descadastrarPorToken } from "./cicloDeVidaCore.server";
import { ErroDeNegocio, executar } from "./resultado.server";

// Preferência de comunicação por e-mail. Desligar vale só para as dicas e novidades (promocionais); os e-mails sobre
// a conta (confirmação, fim do teste, mudança de acesso) continuam, porque a pessoa precisa deles.

export async function obterPreferenciaComunicacao(): Promise<ResultadoAction<PreferenciaComunicacao>> {
  const sessao = await exigirSessaoAction();
  return executar(async () => {
    const u = await prisma.usuario.findUniqueOrThrow({ where: { id: sessao.usuarioId }, select: { emailsPromocionais: true } });
    return { emailsPromocionais: u.emailsPromocionais };
  });
}

export async function salvarPreferenciaComunicacao(emailsPromocionais: boolean): Promise<ResultadoAction<PreferenciaComunicacao>> {
  const sessao = await exigirSessaoAction();
  return executar(async () => {
    if (typeof emailsPromocionais !== "boolean") throw new ErroDeNegocio("Escolha inválida.");
    await definirEmailsPromocionais(sessao.usuarioId, sessao.empresaId, emailsPromocionais);
    return { emailsPromocionais };
  });
}

/**
 * Descadastro pelo link do e-mail. Não exige sessão: o token (único por usuário, só serve para isso) prova que a
 * pessoa recebeu o e-mail. Resposta igual para token existente e inexistente, para o link não servir de oráculo.
 */
export async function descadastrarEmails(token: string): Promise<ResultadoAction<null>> {
  return executar(async () => {
    const ip = await verificarLimite(`descadastro-ip:${extrairIpConfiavel(await headers())}`, 30, 60 * 60 * 1000);
    if (!ip.permitido) throw new ErroDeNegocio("Muitas tentativas. Tente de novo mais tarde.");
    await descadastrarPorToken(token);
    return null;
  });
}
