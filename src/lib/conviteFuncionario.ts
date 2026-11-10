import { createHash, randomBytes } from "node:crypto";

// Token do link de cadastro de funcionário: 32 bytes aleatórios (256 bits), então não dá para adivinhar nem enumerar.
// No banco fica só o hash SHA-256; o token em claro existe apenas no link entregue ao dono.

export const DIAS_DE_VALIDADE_CONVITE_FUNCIONARIO = 7;
const FORMATO = /^[A-Za-z0-9_-]{43}$/;

export function gerarTokenConviteFuncionario(): string {
  return randomBytes(32).toString("base64url");
}

/** O token tem o formato certo? Qualquer outra coisa é descartada sem tocar no banco. */
export function tokenConviteFuncionarioValido(valor: unknown): valor is string {
  return typeof valor === "string" && FORMATO.test(valor);
}

export function hashDoToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function linkDoConviteFuncionario(urlBase: string, token: string): string {
  return `${urlBase.replace(/\/+$/, "")}/cadastro-funcionario/${token}`;
}

export function expiracaoDoConvite(agora = new Date()): string {
  return new Date(agora.getTime() + DIAS_DE_VALIDADE_CONVITE_FUNCIONARIO * 24 * 60 * 60 * 1000).toISOString();
}
