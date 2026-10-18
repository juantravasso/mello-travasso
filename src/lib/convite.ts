import { randomInt } from "node:crypto";

// Código do link de convite de uma empresa. Sem 0/O e 1/I/L: o código é lido em voz alta e digitado com frequência.
// 31 símbolos em 8 posições dão ~8,5 × 10^11 combinações, então não dá para adivinhar um código válido por tentativa.
const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const TAMANHO_CODIGO_CONVITE = 8;

/** Parâmetro da URL de cadastro que carrega o código (`/criar-conta?convite=…`). */
export const PARAMETRO_CONVITE = "convite";

export function gerarCodigoConvite(): string {
  let codigo = "";
  for (let i = 0; i < TAMANHO_CODIGO_CONVITE; i++) codigo += ALFABETO[randomInt(ALFABETO.length)];
  return codigo;
}

/** Devolve o código em maiúsculas se tiver o formato certo; qualquer outra coisa vira null (código ignorado). */
export function normalizarCodigoConvite(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const codigo = valor.trim().toUpperCase();
  if (codigo.length !== TAMANHO_CODIGO_CONVITE) return null;
  for (const caractere of codigo) if (!ALFABETO.includes(caractere)) return null;
  return codigo;
}

export function linkDoConvite(urlBase: string, codigo: string): string {
  return `${urlBase.replace(/\/+$/, "")}/criar-conta?${PARAMETRO_CONVITE}=${codigo}`;
}
