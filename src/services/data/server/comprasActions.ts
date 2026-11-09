"use server";

import { exigirGestaoAction, exigirGestaoEscritaAction } from "@/lib/auth/dal";
import { ACESSO } from "@/lib/auth/modulos";
import type { CompraDetalhe, ListaCompras, ResultadoAction, ResultadoEfetivacao, SugestaoProduto } from "@/types";
import {
  cancelarCompra as cancelar,
  efetivarCompra as efetivar,
  listarCompras as listar,
  obterCompra as obter,
  salvarCompra as salvar,
  sugerirIdentificacao as sugerir,
} from "./comprasCore.server";
import { executar } from "./resultado.server";

// Compras: a regra está em comprasCore.server.ts; aqui só se confere quem chama. Usa o módulo "captura" (quem lança
// documentos), com leitura para quem só consulta.

export async function listarCompras(filtros: unknown): Promise<ResultadoAction<ListaCompras>> {
  return executar(async () => {
    const sessao = await exigirGestaoAction(...ACESSO.contasPagarLer);
    return listar({ empresaId: sessao.empresaId, nome: sessao.nome }, filtros);
  });
}

export async function obterCompra(id: string): Promise<ResultadoAction<CompraDetalhe | null>> {
  return executar(async () => {
    const sessao = await exigirGestaoAction(...ACESSO.contasPagarLer);
    return obter({ empresaId: sessao.empresaId, nome: sessao.nome }, id);
  });
}

export async function salvarCompra(entrada: unknown, id?: string): Promise<ResultadoAction<{ id: string; numero: number }>> {
  return executar(async () => {
    const sessao = await exigirGestaoEscritaAction(...ACESSO.captura);
    return salvar({ empresaId: sessao.empresaId, nome: sessao.nome }, entrada, id);
  });
}

export async function sugerirIdentificacao(entrada: unknown): Promise<ResultadoAction<(SugestaoProduto | null)[]>> {
  return executar(async () => {
    const sessao = await exigirGestaoEscritaAction(...ACESSO.captura);
    return sugerir({ empresaId: sessao.empresaId, nome: sessao.nome }, entrada);
  });
}

export async function efetivarCompra(id: string): Promise<ResultadoAction<ResultadoEfetivacao>> {
  return executar(async () => {
    const sessao = await exigirGestaoEscritaAction(...ACESSO.captura);
    return efetivar({ empresaId: sessao.empresaId, nome: sessao.nome }, id);
  });
}

export async function cancelarCompra(entrada: unknown): Promise<ResultadoAction<{ avisoEstoque?: string }>> {
  return executar(async () => {
    const sessao = await exigirGestaoEscritaAction(...ACESSO.captura);
    return cancelar({ empresaId: sessao.empresaId, nome: sessao.nome }, entrada);
  });
}
