"use server";

import { headers } from "next/headers";
import { extrairIpConfiavel, verificarLimite } from "@/lib/auth/limite";
import { SIGLAS_UF } from "@/lib/rede/ufs";
import { listarCidadesPublicas } from "./redeCore.server";

/**
 * Sugestões de cidade para o autocomplete da busca pública (sem login).
 * Vem da tabela de municípios do IBGE (Municipio), não de uma lista embutida no código.
 */
export async function sugerirCidades(estado: string | undefined, termo: string): Promise<string[]> {
  // POST direto não respeita os tipos do TS.
  if (typeof termo !== "string" || (estado !== undefined && typeof estado !== "string")) return [];
  const texto = termo.trim().slice(0, 60);
  if (texto.length < 2) return [];
  if (estado && !SIGLAS_UF.includes(estado)) return [];

  const limite = await verificarLimite(
    `rede-cidades:${extrairIpConfiavel(await headers())}`,
    120,
    60_000,
  );
  if (!limite.permitido) return [];
  return listarCidadesPublicas(estado, texto);
}
