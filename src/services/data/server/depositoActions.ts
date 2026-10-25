"use server";

import { exigirGestaoEscritaAction, exigirGestaoAction } from "@/lib/auth/dal";
import { ACESSO } from "@/lib/auth/modulos";
import type { NovaTransferenciaInput, ResultadoAction, TransferenciaDeposito, VisaoDeposito } from "@/types";
import * as core from "./depositoCore.server";
import { executar } from "./resultado.server";

// Depósito (estoque central) e transferências para projetos. A regra está em depositoCore.server.ts; aqui só se
// confere quem chama. Ver o Depósito e transferir exige o módulo Estoque; o gasto que a transferência gera aparece
// também para quem acompanha projetos e dashboard.

export async function obterDeposito(): Promise<ResultadoAction<VisaoDeposito>> {
  return executar(async () => core.visaoDoDeposito((await exigirGestaoAction(...ACESSO.estoque)).empresaId));
}

export async function transferirDoDeposito(input: NovaTransferenciaInput): Promise<ResultadoAction<TransferenciaDeposito>> {
  return executar(async () => {
    const sessao = await exigirGestaoEscritaAction(...ACESSO.estoque);
    return core.transferir({ empresaId: sessao.empresaId, nome: sessao.nome }, input);
  });
}

export async function listarTransferencias(filtro?: { obraId?: string; produtoId?: string }): Promise<ResultadoAction<TransferenciaDeposito[]>> {
  return executar(async () => {
    const sessao = await exigirGestaoAction(...ACESSO.transferenciasLer);
    return core.historicoDeTransferencias(sessao.empresaId, { obraId: filtro?.obraId, produtoId: filtro?.produtoId });
  });
}

/** Gasto de cada projeto com material tirado do Depósito (ida menos devolução), por id de projeto. */
export async function obterCustosTransferidos(): Promise<ResultadoAction<Record<string, number>>> {
  return executar(async () => core.custosTransferidosPorProjeto((await exigirGestaoAction(...ACESSO.transferenciasLer)).empresaId));
}

/** Valor unitário que uma movimentação usa para o produto: preço da última compra (ou custo médio). */
export async function obterValorDeReferencia(produtoId: string): Promise<ResultadoAction<{ valor: number; origem: "ultima_compra" | "custo_medio" | "sem_valor" } | null>> {
  return executar(async () => {
    const sessao = await exigirGestaoAction(...ACESSO.estoque);
    return core.valorDeReferencia(sessao.empresaId, produtoId);
  });
}
