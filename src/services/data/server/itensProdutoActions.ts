"use server";

import { prisma } from "@/lib/prisma";
import { exigirGestaoEscritaAction, exigirGestaoAction } from "@/lib/auth/dal";
import { itensProdutoEmLoteSchema } from "@/lib/validacao/itensProduto";
import type { FiltrosItemProduto, HistoricoPrecoProduto, ItemProduto, NovoItemProdutoInput } from "@/types";
import { normalizarDescricao } from "@/lib/normalizarTexto";
import { registrarMovimentoComTx, resolverProdutoComTx } from "./estoqueCore.server";

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
  produtoId: string | null;
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
    produtoId: registro.produtoId ?? undefined,
    criadoEm: registro.criadoEm,
  };
}

export async function listarItensProduto(filtros?: FiltrosItemProduto): Promise<ItemProduto[]> {
  const sessao = await exigirGestaoAction();
  const registros = await prisma.itemProduto.findMany({
    where: {
      empresaId: sessao.empresaId,
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
  const sessao = await exigirGestaoEscritaAction();
  const parsed = itensProdutoEmLoteSchema.safeParse(itens);
  if (!parsed.success) throw new Error("Dados inválidos.");
  if (parsed.data.length === 0) return [];

  // As contas/obras referenciadas precisam já pertencer à empresa da sessão —
  // evita que um item entre vinculado a uma conta/obra de outra empresa.
  const idsContas = [...new Set(parsed.data.map((i) => i.contaFinanceiraId))];
  const idsObras = [...new Set(parsed.data.map((i) => i.obraId))];
  const [contasValidas, obrasValidas] = await Promise.all([
    prisma.contaFinanceira.findMany({ where: { id: { in: idsContas }, empresaId: sessao.empresaId }, select: { id: true } }),
    prisma.obra.findMany({ where: { id: { in: idsObras }, empresaId: sessao.empresaId }, select: { id: true } }),
  ]);
  const idsContasValidas = new Set(contasValidas.map((c) => c.id));
  const idsObrasValidas = new Set(obrasValidas.map((o) => o.id));
  if (idsContas.some((id) => !idsContasValidas.has(id)) || idsObras.some((id) => !idsObrasValidas.has(id))) {
    throw new Error("Conta ou projeto não encontrado.");
  }

  const agora = new Date().toISOString();
  // Transação única para o lote inteiro (não uma por item): criar o
  // ItemProduto, resolver/criar o Produto do catálogo e gerar a entrada de
  // estoque são a mesma operação lógica (RF-06 do PRD de estoque) — se
  // qualquer parte falhar, nada deste lote fica gravado pela metade.
  const criados = await prisma.$transaction(async (tx) => {
    const resultados = [];
    for (const item of parsed.data) {
      const criado = await tx.itemProduto.create({
        data: { ...item, empresaId: sessao.empresaId, criadoEm: agora },
      });

      const produto = await resolverProdutoComTx(tx, sessao.empresaId, item.descricao);
      await tx.itemProduto.update({ where: { id: criado.id }, data: { produtoId: produto.id } });
      await registrarMovimentoComTx(tx, sessao.empresaId, {
        produtoId: produto.id,
        obraId: item.obraId,
        tipo: "entrada",
        quantidadeInformada: item.quantidade,
        valorUnitario: item.valorUnitario,
        origem: "item_produto",
        itemProdutoId: criado.id,
        lancadoPor: sessao.nome,
      });

      resultados.push({ ...criado, produtoId: produto.id });
    }
    return resultados;
  });
  return criados.map(paraItem);
}

export async function historicoPrecoPorDescricao(descricao: string): Promise<HistoricoPrecoProduto | null> {
  const sessao = await exigirGestaoAction();
  const alvo = normalizarDescricao(descricao);
  const registros = await prisma.itemProduto.findMany({
    where: { empresaId: sessao.empresaId },
    orderBy: { dataCompra: "asc" },
  });
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
  const sessao = await exigirGestaoAction();
  const registros = await prisma.itemProduto.findMany({
    where: { empresaId: sessao.empresaId },
    select: { descricao: true },
  });
  const vistos = new Map<string, string>();
  for (const { descricao } of registros) {
    const chave = normalizarDescricao(descricao);
    if (!vistos.has(chave)) vistos.set(chave, descricao);
  }
  return Array.from(vistos.values()).sort((a, b) => a.localeCompare(b));
}
