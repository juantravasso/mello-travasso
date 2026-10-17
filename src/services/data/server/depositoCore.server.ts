import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { custoDaTransferencia } from "@/lib/estoque/rateio";
import { transferenciaSchema } from "@/lib/validacao/estoque";
import type {
  NovaTransferenciaInput,
  ProdutoNoDeposito,
  TransferenciaDeposito,
  VisaoDeposito,
} from "@/types";
import {
  registrarMovimentoComTx,
  SaldoInsuficienteError,
} from "./estoqueCore.server";
import { ErroDeNegocio } from "./resultado.server";

// Regras do Depósito: o estoque central da empresa. Material comprado para o Depósito não é custo de projeto; passa a
// ser quando é transferido, ao valor da última compra. Recebe sempre o contexto que veio da SESSÃO.

export interface ContextoDeposito {
  empresaId: string;
  /** Nome de quem lança (fica no histórico do estoque). */
  nome: string;
}

/** Cria o Depósito da empresa se ainda não existir (empresas novas) e devolve o id. */
export async function garantirDeposito(
  empresaId: string,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<string> {
  const existente = await tx.obra.findFirst({
    where: { empresaId, ehDeposito: true },
    select: { id: true },
  });
  if (existente) return existente.id;
  const agora = new Date().toISOString();
  try {
    const criado = await tx.obra.create({
      data: {
        empresaId,
        nome: "Depósito",
        cliente: "Interno",
        status: "em_andamento",
        dataInicio: agora.slice(0, 10),
        ehDeposito: true,
        criadoEm: agora,
        atualizadoEm: agora,
      },
      select: { id: true },
    });
    return criado.id;
  } catch (erro) {
    // Duas requisições criando ao mesmo tempo: o índice único parcial rejeita a segunda — usa a que ganhou.
    if (
      erro instanceof Prisma.PrismaClientKnownRequestError &&
      erro.code === "P2002"
    ) {
      const vencedor = await tx.obra.findFirst({
        where: { empresaId, ehDeposito: true },
        select: { id: true },
      });
      if (vencedor) return vencedor.id;
    }
    throw erro;
  }
}

interface CompraRegistrada {
  valorUnitario: number;
  dataCompra: string;
  fornecedor: string | null;
  produtoId: string | null;
}

/** Última compra de cada produto (itens de contas não canceladas), do mais recente para o mais antigo. */
async function ultimasCompras(
  tx: Prisma.TransactionClient | typeof prisma,
  empresaId: string,
  produtoIds: string[],
): Promise<Map<string, CompraRegistrada>> {
  if (produtoIds.length === 0) return new Map();
  const itens = await tx.itemProduto.findMany({
    where: {
      empresaId,
      produtoId: { in: produtoIds },
      contaFinanceira: { status: { not: "cancelada" } },
    },
    orderBy: [{ dataCompra: "desc" }, { criadoEm: "desc" }],
    distinct: ["produtoId"],
    select: {
      produtoId: true,
      valorUnitario: true,
      dataCompra: true,
      fornecedor: true,
    },
  });
  const mapa = new Map<string, CompraRegistrada>();
  for (const i of itens) if (i.produtoId) mapa.set(i.produtoId, i);
  return mapa;
}

type Origem = ProdutoNoDeposito["origemDoValor"];

function valorUnitarioDe(
  compra: CompraRegistrada | undefined,
  custoMedio: number | null,
): { valor: number; origem: Origem } {
  if (compra) return { valor: compra.valorUnitario, origem: "ultima_compra" };
  if (custoMedio != null && custoMedio > 0)
    return { valor: custoMedio, origem: "custo_medio" };
  return { valor: 0, origem: "sem_valor" };
}

export async function visaoDoDeposito(
  empresaId: string,
): Promise<VisaoDeposito> {
  const depositoId = await garantirDeposito(empresaId);
  const [produtos, saldos] = await Promise.all([
    prisma.produto.findMany({ where: { empresaId }, orderBy: { nome: "asc" } }),
    prisma.saldoEstoque.findMany({
      where: { empresaId, quantidade: { not: 0 } },
    }),
  ]);
  const compras = await ultimasCompras(
    prisma,
    empresaId,
    produtos.map((p) => p.id),
  );

  const noDeposito = new Map<string, number>();
  const nosProjetos = new Map<
    string,
    { obraId: string; quantidade: number }[]
  >();
  for (const s of saldos) {
    if (s.obraId === depositoId) noDeposito.set(s.produtoId, s.quantidade);
    else
      nosProjetos.set(s.produtoId, [
        ...(nosProjetos.get(s.produtoId) ?? []),
        { obraId: s.obraId, quantidade: s.quantidade },
      ]);
  }

  const linhas: ProdutoNoDeposito[] = produtos.map((p) => {
    const quantidade = noDeposito.get(p.id) ?? 0;
    const compra = compras.get(p.id);
    const { valor, origem } = valorUnitarioDe(compra, p.custoMedio);
    return {
      produtoId: p.id,
      nome: p.nome,
      unidade: p.unidade ?? undefined,
      categoria: p.categoria ?? undefined,
      estoqueMinimo: p.estoqueMinimo ?? undefined,
      quantidade,
      nosProjetos: (nosProjetos.get(p.id) ?? []).sort(
        (a, b) => b.quantidade - a.quantidade,
      ),
      ultimaCompra: compra
        ? {
            valorUnitario: compra.valorUnitario,
            data: compra.dataCompra,
            fornecedor: compra.fornecedor ?? undefined,
          }
        : undefined,
      valorUnitario: valor,
      valorEmEstoque: custoDaTransferencia(quantidade, valor),
      origemDoValor: origem,
      abaixoDoMinimo: p.estoqueMinimo != null && quantidade < p.estoqueMinimo,
    };
  });

  const comSaldo = linhas.filter((l) => l.quantidade > 0);
  return {
    depositoId,
    produtos: linhas,
    valorTotalEmEstoque: custoDaTransferencia(
      1,
      comSaldo.reduce((s, l) => s + l.valorEmEstoque, 0),
    ),
    totalProdutos: comSaldo.length,
    semValor: comSaldo.filter((l) => l.origemDoValor === "sem_valor").length,
  };
}

/**
 * Move `quantidade` entre o Depósito e um projeto ao valor da última compra (ou, sem compra, ao custo médio; sem
 * nenhum dos dois, a zero — a UI avisa antes). São dois movimentos ligados pelo mesmo `transferenciaId`, na mesma
 * transação: ou os dois acontecem ou nenhum. Não mexe em conta, caixa nem custo médio.
 */
export async function transferir(
  ctx: ContextoDeposito,
  entrada: NovaTransferenciaInput,
): Promise<TransferenciaDeposito> {
  const parsed = transferenciaSchema.safeParse(entrada);
  if (!parsed.success)
    throw new ErroDeNegocio(
      parsed.error.issues[0]?.message ?? "Dados inválidos.",
    );
  const { produtoId, obraId, quantidade, observacao } = parsed.data;
  const sentido = parsed.data.sentido ?? "para_projeto";

  try {
    return await prisma.$transaction(
      async (tx) => {
        const produto = await tx.produto.findFirst({
          where: { id: produtoId, empresaId: ctx.empresaId },
        });
        const obra = await tx.obra.findFirst({
          where: { id: obraId, empresaId: ctx.empresaId },
        });
        if (!produto) throw new ErroDeNegocio("Produto não encontrado.");
        if (!obra) throw new ErroDeNegocio("Projeto não encontrado.");
        if (obra.ehDeposito)
          throw new ErroDeNegocio(
            "Escolha um projeto: o Depósito é a origem ou o destino da transferência.",
          );

        const depositoId = await garantirDeposito(ctx.empresaId, tx);
        const compra = (
          await ultimasCompras(tx, ctx.empresaId, [produtoId])
        ).get(produtoId);
        const { valor } = valorUnitarioDe(compra, produto.custoMedio);

        const origemId = sentido === "para_projeto" ? depositoId : obraId;
        const destinoId = sentido === "para_projeto" ? obraId : depositoId;
        const transferenciaId = randomUUID();
        const base = {
          produtoId,
          quantidadeInformada: quantidade,
          valorUnitario: valor,
          origem: "transferencia" as const,
          transferenciaId,
          lancadoPor: ctx.nome,
          observacao,
        };

        const saida = await registrarMovimentoComTx(tx, ctx.empresaId, {
          ...base,
          obraId: origemId,
          tipo: "saida",
        });
        await registrarMovimentoComTx(tx, ctx.empresaId, {
          ...base,
          obraId: destinoId,
          tipo: "entrada",
        });

        return {
          id: transferenciaId,
          produtoId,
          produtoNome: produto.nome,
          unidade: produto.unidade ?? undefined,
          obraId,
          sentido,
          quantidade,
          valorUnitario: valor,
          custo: custoDaTransferencia(quantidade, valor),
          lancadoPor: ctx.nome,
          observacao,
          criadoEm: saida.criadoEm,
        };
        // Uma transferência faz poucas escritas, mas o banco é remoto: o padrão de 5 s já cortou uma no meio.
      },
      { timeout: 30_000, maxWait: 10_000 },
    );
  } catch (erro) {
    if (erro instanceof SaldoInsuficienteError) {
      const onde = sentido === "para_projeto" ? "no Depósito" : "no projeto";
      throw new ErroDeNegocio(
        `Saldo insuficiente ${onde}: há ${erro.saldoAtual} disponível.`,
      );
    }
    throw erro;
  }
}

/** Linhas de transferência que mexem num projeto (a do lado do Depósito é a mesma transferência vista ao contrário). */
async function movimentosDeTransferencia(
  empresaId: string,
  filtro: { obraId?: string; produtoId?: string },
  limite?: number,
) {
  const depositoId = await garantirDeposito(empresaId);
  const registros = await prisma.movimentoEstoque.findMany({
    where: {
      empresaId,
      origem: "transferencia",
      // Só o lado do projeto: a entrada na ida e a saída na devolução.
      obraId: filtro.obraId ?? { not: depositoId },
      produtoId: filtro.produtoId,
    },
    orderBy: { criadoEm: "desc" },
    take: limite,
    include: { produto: { select: { nome: true, unidade: true } } },
  });
  return registros;
}

export async function historicoDeTransferencias(
  empresaId: string,
  filtro: { obraId?: string; produtoId?: string } = {},
  limite = 200,
): Promise<TransferenciaDeposito[]> {
  const registros = await movimentosDeTransferencia(empresaId, filtro, limite);
  return registros.map((m) => {
    const valorUnitario = m.valorUnitario ?? 0;
    return {
      // O lado do projeto basta: entrada = ida, saída = devolução.
      id: m.transferenciaId ?? m.id,
      produtoId: m.produtoId,
      produtoNome: m.produto.nome,
      unidade: m.produto.unidade ?? undefined,
      obraId: m.obraId,
      sentido:
        m.tipo === "entrada"
          ? ("para_projeto" as const)
          : ("devolucao" as const),
      quantidade: m.quantidade,
      valorUnitario,
      custo: custoDaTransferencia(m.quantidade, valorUnitario),
      lancadoPor: m.lancadoPor,
      observacao: m.observacao ?? undefined,
      criadoEm: m.criadoEm,
    };
  });
}

/** Gasto de cada projeto com material vindo do Depósito: o que entrou menos o que voltou. */
export async function custosTransferidosPorProjeto(
  empresaId: string,
): Promise<Record<string, number>> {
  const registros = await movimentosDeTransferencia(empresaId, {});
  const centavos: Record<string, number> = {};
  for (const m of registros) {
    const custo = Math.round(
      custoDaTransferencia(m.quantidade, m.valorUnitario ?? 0) * 100,
    );
    centavos[m.obraId] =
      (centavos[m.obraId] ?? 0) + (m.tipo === "entrada" ? custo : -custo);
  }
  return Object.fromEntries(
    Object.entries(centavos).map(([obraId, c]) => [obraId, c / 100]),
  );
}
