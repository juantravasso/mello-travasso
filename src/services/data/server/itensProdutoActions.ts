"use server";

import { prisma } from "@/lib/prisma";
import type { FiltrosItemProduto, HistoricoPrecoProduto, ItemProduto, NovoItemProdutoInput } from "@/types";
import { normalizarDescricao } from "@/lib/normalizarTexto";

function paraItem(registro: {
  id: string;
  contaFinanceiraId: string;
  obraId: string;
  descricao: string;
  quantidade: number;
  unidade: string | null;
  valorUnitario: number;
  valorTotal: number;
  dataCompra: string;
  fornecedor: string | null;
  criadoEm: string;
}): ItemProduto {
  return {
    id: registro.id,
    contaFinanceiraId: registro.contaFinanceiraId,
    obraId: registro.obraId,
    descricao: registro.descricao,
    quantidade: registro.quantidade,
    unidade: registro.unidade ?? undefined,
    valorUnitario: registro.valorUnitario,
    valorTotal: registro.valorTotal,
    dataCompra: registro.dataCompra,
    fornecedor: registro.fornecedor ?? undefined,
    criadoEm: registro.criadoEm,
  };
}

export async function listarItensProduto(filtros?: FiltrosItemProduto): Promise<ItemProduto[]> {
  const registros = await prisma.itemProduto.findMany({
    where: {
      obraId: filtros?.obraId,
      fornecedor: filtros?.fornecedor,
      dataCompra: {
        gte: filtros?.dataInicio,
        lte: filtros?.dataFim,
      },
    },
    orderBy: { dataCompra: "desc" },
  });
  const itens = registros.map(paraItem);
  if (!filtros?.descricao) return itens;
  const alvo = normalizarDescricao(filtros.descricao);
  return itens.filter((item) => normalizarDescricao(item.descricao).includes(alvo));
}

export async function criarItensProdutoEmLote(itens: NovoItemProdutoInput[]): Promise<ItemProduto[]> {
  const agora = new Date().toISOString();
  const criados = await prisma.$transaction(
    itens.map((item) => prisma.itemProduto.create({ data: { ...item, criadoEm: agora } })),
  );
  return criados.map(paraItem);
}

export async function historicoPrecoPorDescricao(descricao: string): Promise<HistoricoPrecoProduto | null> {
  const alvo = normalizarDescricao(descricao);
  const registros = await prisma.itemProduto.findMany({ orderBy: { dataCompra: "asc" } });
  const ocorrencias = registros.map(paraItem).filter((item) => normalizarDescricao(item.descricao) === alvo);
  if (ocorrencias.length === 0) return null;

  const valores = ocorrencias.map((item) => item.valorUnitario);
  const ultimaCompra = ocorrencias[ocorrencias.length - 1];
  if (!ultimaCompra) return null;

  return {
    descricaoNormalizada: alvo,
    ocorrencias,
    menorPreco: Math.min(...valores),
    maiorPreco: Math.max(...valores),
    precoMedio: valores.reduce((soma, v) => soma + v, 0) / valores.length,
    ultimaCompra,
  };
}

export async function listarDescricoesUnicasProduto(): Promise<string[]> {
  const registros = await prisma.itemProduto.findMany({ select: { descricao: true } });
  const vistos = new Map<string, string>();
  for (const { descricao } of registros) {
    const chave = normalizarDescricao(descricao);
    if (!vistos.has(chave)) vistos.set(chave, descricao);
  }
  return Array.from(vistos.values()).sort((a, b) => a.localeCompare(b));
}
