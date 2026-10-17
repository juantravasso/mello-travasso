"use server";

import { exigirGestaoEscritaAction } from "@/lib/auth/dal";
import { ACESSO } from "@/lib/auth/modulos";
import type { ResultadoAction, ResultadoCaptura } from "@/types";
import { registrarCaptura as gravarCaptura } from "./capturaCore.server";
import { executar } from "./resultado.server";

// Captura de documentos: a regra está em capturaCore.server.ts; aqui só se confere quem chama.

export async function registrarCaptura(entrada: unknown): Promise<ResultadoAction<ResultadoCaptura>> {
  return executar(async () => {
    const sessao = await exigirGestaoEscritaAction(...ACESSO.captura);
    return gravarCaptura({ empresaId: sessao.empresaId, nome: sessao.nome }, entrada);
  });
}
