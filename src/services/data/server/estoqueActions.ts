"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { exigirEscritaAction, exigirSessaoAction } from "@/lib/auth/dal";
import { novoProdutoSchema, movimentoEstoqueSchema } from "@/lib/validacao/estoque";
import type {
  MovimentoEstoque,
  NovoMovimentoInput,
  NovoProdutoInput,
  Produto,
  ProdutoComSaldo,
  ProdutoDetalhado,
  TipoMovimentoEstoque,
} from "@/types";

/**
 * Erro interno para "saída/ajuste deixaria o saldo negativo" (RF-04 do PRD
 * de estoque). Carrega o saldo atual pra montar a mensagem no campo certo —
 * quem chama (`registrarMovimento`) traduz pra uma mensagem que o formulário
 * sabe reconhecer, já que o projeto não usa um ResultadoAction<T> genérico
 * fora do fluxo de auth.
 */
class SaldoInsuficienteError extends Error {
  constructor(public readonly saldoAtual: number) {
    super(`SALDO_INSUFICIENTE:${saldoAtual}`);
  }
}

/**
 * Erro interno para "o saldo mudou entre a UI carregar e o ajuste ser
 * enviado" — concorrência otimista em `definirSaldo` (só se aplica a
 * "ajuste", que grava um valor absoluto e por isso precisa de uma
 * precondição, ao contrário de entrada/saída, que somam/subtraem via
 * `ajustarSaldo`).
 */
class SaldoDivergenteError extends Error {
  constructor(public readonly saldoAtual: number) {
    super(`SALDO_MUDOU:${saldoAtual}`);
  }
}

function paraProduto(registro: {
  id: string;
  nome: string;
  sku: string | null;
  categoria: string | null;
  unidade: string | null;
  custoMedio: number | null;
  estoqueMinimo: number | null;
  observacao: string | null;
  criadoEm: string;
  atualizadoEm: string;
}): Produto {
  return {
    id: registro.id,
    nome: registro.nome,
    sku: registro.sku ?? undefined,
    categoria: registro.categoria ?? undefined,
    unidade: registro.unidade ?? undefined,
    custoMedio: registro.custoMedio ?? undefined,
    estoqueMinimo: registro.estoqueMinimo ?? undefined,
    observacao: registro.observacao ?? undefined,
    criadoEm: registro.criadoEm,
    atualizadoEm: registro.atualizadoEm,
  };
}

function paraMovimento(registro: {
  id: string;
  produtoId: string;
  obraId: string;
  tipo: string;
  quantidade: number;
  valorUnitario: number | null;
  origem: string;
  itemProdutoId: string | null;
  lancadoPor: string;
  observacao: string | null;
  criadoEm: string;
}): MovimentoEstoque {
  return {
    id: registro.id,
    produtoId: registro.produtoId,
    obraId: registro.obraId,
    tipo: registro.tipo as TipoMovimentoEstoque,
    quantidade: registro.quantidade,
    valorUnitario: registro.valorUnitario ?? undefined,
    origem: registro.origem as MovimentoEstoque["origem"],
    itemProdutoId: registro.itemProdutoId ?? undefined,
    lancadoPor: registro.lancadoPor,
    observacao: registro.observacao ?? undefined,
    criadoEm: registro.criadoEm,
  };
}

/** Confere que produto e obra referenciados pertencem à empresa da sessão antes de gravar. */
async function validarReferenciasEstoque(empresaId: string, produtoId: string, obraId: string): Promise<void> {
  const [produto, obra] = await Promise.all([
    prisma.produto.findFirst({ where: { id: produtoId, empresaId } }),
    prisma.obra.findFirst({ where: { id: obraId, empresaId } }),
  ]);
  if (!produto) throw new Error("Produto não encontrado.");
  if (!obra) throw new Error("Obra não encontrada.");
}

/**
 * Soma/subtrai `delta` do saldo de (produtoId, obraId) de forma atômica: a
 * checagem "não fica negativo" e a escrita são o mesmo UPDATE, então duas
 * saídas concorrentes não conseguem as duas passar (ver PRD, seção 5 — RNF
 * de concorrência). Se a linha ainda não existe (1º movimento deste produto
 * nesta obra), cria — uma saída sem saldo nenhum cai no mesmo erro de saldo
 * insuficiente (0 disponível), que é o comportamento certo.
 */
async function ajustarSaldo(
  tx: Prisma.TransactionClient,
  params: { empresaId: string; produtoId: string; obraId: string; delta: number; agora: string },
): Promise<void> {
  const linhasAfetadas = await tx.$executeRaw`
    UPDATE "SaldoEstoque"
    SET "quantidade" = "quantidade" + ${params.delta}, "atualizadoEm" = ${params.agora}
    WHERE "produtoId" = ${params.produtoId} AND "obraId" = ${params.obraId}
      AND "quantidade" + ${params.delta} >= 0
  `;
  if (linhasAfetadas > 0) return;

  const existente = await tx.saldoEstoque.findUnique({
    where: { produtoId_obraId: { produtoId: params.produtoId, obraId: params.obraId } },
  });
  if (existente) {
    throw new SaldoInsuficienteError(existente.quantidade);
  }
  if (params.delta < 0) {
    throw new SaldoInsuficienteError(0);
  }
  try {
    await tx.saldoEstoque.create({
      data: {
        empresaId: params.empresaId,
        produtoId: params.produtoId,
        obraId: params.obraId,
        quantidade: params.delta,
        atualizadoEm: params.agora,
      },
    });
  } catch (erro) {
    // Corrida rara: outra transação criou a linha entre o findUnique e o
    // create acima — @@unique([produtoId, obraId]) rejeita, tenta de novo
    // como update (agora a linha existe).
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") {
      await ajustarSaldo(tx, params);
      return;
    }
    throw erro;
  }
}

/**
 * "Ajuste" define o saldo final diretamente (não soma/subtrai), mas isso não
 * é imune a corrida: se uma entrada/saída for confirmada entre a UI mostrar
 * "saldo atual: X" e o envio do ajuste, sobrescrever sem checar perderia essa
 * mudança (lost update). `saldoEsperado` é o valor que a UI mostrou — o
 * UPDATE só aplica se o saldo no banco ainda for esse; senão, quem chamou
 * decide (mostrar "o saldo mudou, confira de novo").
 */
async function definirSaldo(
  tx: Prisma.TransactionClient,
  params: { empresaId: string; produtoId: string; obraId: string; quantidade: number; saldoEsperado: number; agora: string },
): Promise<void> {
  const linhasAfetadas = await tx.$executeRaw`
    UPDATE "SaldoEstoque"
    SET "quantidade" = ${params.quantidade}, "atualizadoEm" = ${params.agora}
    WHERE "produtoId" = ${params.produtoId} AND "obraId" = ${params.obraId} AND "quantidade" = ${params.saldoEsperado}
  `;
  if (linhasAfetadas > 0) return;

  const existente = await tx.saldoEstoque.findUnique({
    where: { produtoId_obraId: { produtoId: params.produtoId, obraId: params.obraId } },
  });
  if (existente) {
    throw new SaldoDivergenteError(existente.quantidade);
  }
  if (params.saldoEsperado !== 0) {
    // Não existe linha ainda, mas a UI não mostrava saldo 0 — só pode ter
    // sido criada e depois removida, ou a UI estava desatualizada.
    throw new SaldoDivergenteError(0);
  }
  try {
    await tx.saldoEstoque.create({
      data: {
        empresaId: params.empresaId,
        produtoId: params.produtoId,
        obraId: params.obraId,
        quantidade: params.quantidade,
        atualizadoEm: params.agora,
      },
    });
  } catch (erro) {
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") {
      await definirSaldo(tx, params);
      return;
    }
    throw erro;
  }
}

/** Média ponderada pelo saldo TOTAL do produto (todas as obras), recalculada só em entrada (RF-08). */
async function atualizarCustoMedio(
  tx: Prisma.TransactionClient,
  produtoId: string,
  valorUnitarioNovo: number,
  quantidadeNova: number,
  agora: string,
): Promise<void> {
  const agregado = await tx.saldoEstoque.aggregate({ where: { produtoId }, _sum: { quantidade: true } });
  const saldoTotalDepois = agregado._sum.quantidade ?? quantidadeNova;
  const saldoTotalAntes = saldoTotalDepois - quantidadeNova;

  const produto = await tx.produto.findUniqueOrThrow({ where: { id: produtoId } });
  const custoAtual = produto.custoMedio ?? valorUnitarioNovo;
  const novoCustoMedio =
    saldoTotalAntes <= 0
      ? valorUnitarioNovo
      : (custoAtual * saldoTotalAntes + valorUnitarioNovo * quantidadeNova) / (saldoTotalAntes + quantidadeNova);

  await tx.produto.update({ where: { id: produtoId }, data: { custoMedio: novoCustoMedio, atualizadoEm: agora } });
}

interface ParametrosMovimento {
  produtoId: string;
  obraId: string;
  tipo: TipoMovimentoEstoque;
  /** Para "ajuste", é o saldo final desejado (não a diferença) — ver RF-04. */
  quantidadeInformada: number;
  /** Só para "ajuste" — saldo que a UI mostrou, ver definirSaldo(). */
  saldoEsperado?: number;
  valorUnitario?: number;
  origem: "manual" | "item_produto";
  itemProdutoId?: string;
  lancadoPor: string;
  observacao?: string;
}

/**
 * Núcleo transacional, reaproveitado pela Fase 5.2 (entrada automática a
 * partir de um ItemProduto capturado por IA) além do formulário manual.
 */
async function registrarMovimentoInterno(empresaId: string, p: ParametrosMovimento): Promise<MovimentoEstoque> {
  const agora = new Date().toISOString();

  return prisma.$transaction(async (tx) => {
    // Guardamos sempre o que o usuário digitou — para "ajuste" isso já é o
    // saldo final (não a diferença), então o histórico pode mostrar "Ajuste
    // para X" com o mesmo número que a pessoa informou (ver HistoricoMovimentos).
    const quantidadeRegistrada = p.quantidadeInformada;

    if (p.tipo === "ajuste") {
      await definirSaldo(tx, {
        empresaId,
        produtoId: p.produtoId,
        obraId: p.obraId,
        quantidade: p.quantidadeInformada,
        saldoEsperado: p.saldoEsperado ?? 0,
        agora,
      });
    } else {
      const delta = p.tipo === "entrada" ? p.quantidadeInformada : -p.quantidadeInformada;
      await ajustarSaldo(tx, { empresaId, produtoId: p.produtoId, obraId: p.obraId, delta, agora });
    }

    if (p.tipo === "entrada" && p.valorUnitario != null) {
      await atualizarCustoMedio(tx, p.produtoId, p.valorUnitario, p.quantidadeInformada, agora);
    }

    const movimento = await tx.movimentoEstoque.create({
      data: {
        empresaId,
        produtoId: p.produtoId,
        obraId: p.obraId,
        tipo: p.tipo,
        quantidade: quantidadeRegistrada,
        valorUnitario: p.valorUnitario,
        origem: p.origem,
        itemProdutoId: p.itemProdutoId,
        lancadoPor: p.lancadoPor,
        observacao: p.observacao,
        criadoEm: agora,
      },
    });
    return paraMovimento(movimento);
  });
}

export async function listarProdutos(): Promise<ProdutoComSaldo[]> {
  const sessao = await exigirSessaoAction();
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
  const sessao = await exigirSessaoAction();
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
  const sessao = await exigirSessaoAction();
  const registros = await prisma.movimentoEstoque.findMany({
    where: { produtoId, empresaId: sessao.empresaId },
    orderBy: { criadoEm: "desc" },
  });
  return registros.map(paraMovimento);
}

export async function criarProduto(input: NovoProdutoInput): Promise<Produto> {
  const sessao = await exigirEscritaAction();
  const parsed = novoProdutoSchema.safeParse(input);
  if (!parsed.success) throw new Error("Dados inválidos.");

  const agora = new Date().toISOString();
  const registro = await prisma.produto.create({
    data: { ...parsed.data, empresaId: sessao.empresaId, criadoEm: agora, atualizadoEm: agora },
  });
  return paraProduto(registro);
}

export async function registrarMovimento(input: NovoMovimentoInput): Promise<MovimentoEstoque> {
  const sessao = await exigirEscritaAction();
  const parsed = movimentoEstoqueSchema.safeParse(input);
  if (!parsed.success) throw new Error("Dados inválidos.");
  const { produtoId, obraId, tipo, quantidade, saldoEsperado, valorUnitario, observacao } = parsed.data;

  await validarReferenciasEstoque(sessao.empresaId, produtoId, obraId);

  try {
    return await registrarMovimentoInterno(sessao.empresaId, {
      produtoId,
      obraId,
      tipo,
      quantidadeInformada: quantidade,
      saldoEsperado,
      valorUnitario,
      origem: "manual",
      lancadoPor: sessao.nome,
      observacao,
    });
  } catch (erro) {
    if (erro instanceof SaldoInsuficienteError || erro instanceof SaldoDivergenteError) throw new Error(erro.message);
    throw erro;
  }
}
