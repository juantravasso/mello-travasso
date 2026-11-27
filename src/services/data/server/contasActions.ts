"use server";

import { exigirGestaoEscritaAction, exigirGestaoAction } from "@/lib/auth/dal";
import { ACESSO } from "@/lib/auth/modulos";
import type {
  BaixarContaInput,
  BaixarContasEmLoteInput,
  CancelarContaInput,
  CompromissoItem,
  ContaFinanceira,
  FiltrosContaFinanceira,
  NovaContaFinanceiraInput,
  ResultadoAction,
  ResultadoBaixaEmLote,
  ResultadoCancelamentoConta,
  TipoConta,
} from "@/types";
import * as core from "./contasCore.server";

// Contas a pagar e a receber pelo site: aqui só se confere quem chama (sessão, plano, módulo, somente leitura). A regra
// está em contasCore.server.ts, a mesma usada pelo assistente do WhatsApp.

const leitura = () => exigirGestaoAction(...ACESSO.contasPagarLer, ...ACESSO.contasReceberLer);
const escrita = () => exigirGestaoEscritaAction(...ACESSO.contasPagarEscrever, ...ACESSO.contasReceberEscrever);

export async function listarContas(filtros?: FiltrosContaFinanceira & { tipo?: TipoConta }): Promise<ContaFinanceira[]> {
  return core.listarContas(await leitura(), filtros);
}

export async function listarContasNoCalendario(de: string, ate: string): Promise<CompromissoItem[]> {
  return core.listarContasNoCalendario(await leitura(), de, ate);
}

export async function obterContaPorId(id: string): Promise<ContaFinanceira | null> {
  return core.obterContaPorId(await leitura(), id);
}

export async function criarConta(input: NovaContaFinanceiraInput): Promise<ContaFinanceira> {
  return core.criarConta(await escrita(), input);
}

export async function atualizarConta(id: string, input: Partial<NovaContaFinanceiraInput>): Promise<ContaFinanceira> {
  return core.atualizarConta(await escrita(), id, input);
}

export async function baixarConta(input: BaixarContaInput): Promise<ContaFinanceira> {
  return core.baixarConta(await escrita(), input);
}

export async function baixarContasEmLote(input: BaixarContasEmLoteInput): Promise<ResultadoAction<ResultadoBaixaEmLote>> {
  return core.baixarContasEmLote(await escrita(), input);
}

export async function cancelarConta(input: CancelarContaInput): Promise<ResultadoCancelamentoConta> {
  return core.cancelarConta(await escrita(), input);
}
