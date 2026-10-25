"use server";

import { prisma } from "@/lib/prisma";
import { exigirGestaoEscritaAction, exigirGestaoAction } from "@/lib/auth/dal";
import { ACESSO } from "@/lib/auth/modulos";
import { novoProdutoSchema, movimentoEstoqueSchema } from "@/lib/validacao/estoque";
import {
  paraProduto,
  paraMovimento,
  registrarMovimentoInterno,
  SaldoDivergenteError,
  SaldoInsuficienteError,
} from "./estoqueCore.server";
import { valorDeReferencia } from "./depositoCore.server";
import type { MovimentoEstoque, NovoMovimentoInput, NovoProdutoInput, Produto, ProdutoComSaldo, ProdutoDetalhado } from "@/types";

/** Confere que produto e obra referenciados pertencem à empresa da sessão antes de gravar. */
async function validarReferenciasEstoque(empresaId: string, produtoId: string, obraId: string): Promise<void> {
  const [produto, obra] = await Promise.all([
    prisma.produto.findFirst({ where: { id: produtoId, empresaId } }),
    prisma.obra.findFirst({ where: { id: obraId, empresaId } }),
  ]);
  if (!produto) throw new Error("Produto não encontrado.");
  if (!obra) throw new Error("Projeto não encontrado.");
}

export async function listarProdutos(): Promise<ProdutoComSaldo[]> {
  const sessao = await exigirGestaoAction(...ACESSO.estoque);
  const [produtos, saldos] = await Promise.all([
    prisma.produto.findMany({ where: { empresaId: sessao.empresaId }, orderBy: { nome: "asc" } }),
    prisma.saldoEstoque.groupBy({
      by: ["produtoId"],
      where: { empresaId: sessao.empresaId },
      _sum: { quantidade: true },
    }),
  ]);
  const saldoPorProduto = new Map(saldos.map((s) => [s.produtoId, s._sum.quantidade ?? 0]));
  return produtos.map((p) => ({ ...paraProduto(p), saldoTotal: saldoPorProduto.get(p.id) ?? 0 }));
}

export async function obterProdutoPorId(id: string): Promise<ProdutoDetalhado | null> {
  const sessao = await exigirGestaoAction(...ACESSO.estoque);
  const produto = await prisma.produto.findFirst({ where: { id, empresaId: sessao.empresaId } });
  if (!produto) return null;

  const saldos = await prisma.saldoEstoque.findMany({ where: { produtoId: id, empresaId: sessao.empresaId } });
  return {
    ...paraProduto(produto),
    saldoTotal: saldos.reduce((soma, s) => soma + s.quantidade, 0),
    saldosPorObra: saldos.filter((s) => s.quantidade !== 0).map((s) => ({ obraId: s.obraId, quantidade: s.quantidade })),
  };
}

export async function listarMovimentos(produtoId: string): Promise<MovimentoEstoque[]> {
  const sessao = await exigirGestaoAction(...ACESSO.estoque);
  const registros = await prisma.movimentoEstoque.findMany({
    where: { produtoId, empresaId: sessao.empresaId },
    orderBy: { criadoEm: "desc" },
  });
  return registros.map(paraMovimento);
}

export async function criarProduto(input: NovoProdutoInput): Promise<Produto> {
  const sessao = await exigirGestaoEscritaAction(...ACESSO.estoque);
  const parsed = novoProdutoSchema.safeParse(input);
  if (!parsed.success) throw new Error("Dados inválidos.");

  const agora = new Date().toISOString();
  const registro = await prisma.produto.create({
    data: { ...parsed.data, empresaId: sessao.empresaId, criadoEm: agora, atualizadoEm: agora },
  });
  return paraProduto(registro);
}

export async function registrarMovimento(input: NovoMovimentoInput): Promise<MovimentoEstoque> {
  const sessao = await exigirGestaoEscritaAction(...ACESSO.estoque);
  const parsed = movimentoEstoqueSchema.safeParse(input);
  if (!parsed.success) throw new Error("Dados inválidos.");
  const { produtoId, obraId, tipo, quantidade, saldoEsperado, valorUnitario, observacao } = parsed.data;

  await validarReferenciasEstoque(sessao.empresaId, produtoId, obraId);

  // Entrada e saída valem pelo preço da última compra do produto (o que faz o material entrar como gasto do projeto);
  // o valor que veio da tela só vale quando o produto nunca foi comprado nem tem custo médio.
  let valorDoMovimento = valorUnitario;
  if (tipo !== "ajuste") {
    const referencia = await valorDeReferencia(sessao.empresaId, produtoId);
    valorDoMovimento = referencia && referencia.origem !== "sem_valor" ? referencia.valor : valorUnitario;
  }

  try {
    return await registrarMovimentoInterno(sessao.empresaId, {
      produtoId,
      obraId,
      tipo,
      quantidadeInformada: quantidade,
      saldoEsperado,
      valorUnitario: valorDoMovimento,
      origem: "manual",
      lancadoPor: sessao.nome,
      observacao,
    });
  } catch (erro) {
    if (erro instanceof SaldoInsuficienteError || erro instanceof SaldoDivergenteError) throw new Error(erro.message);
    throw erro;
  }
}
