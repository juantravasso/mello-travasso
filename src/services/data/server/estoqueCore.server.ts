import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizarDescricao } from "@/lib/normalizarTexto";
import type { MovimentoEstoque, Produto, TipoMovimentoEstoque } from "@/types";

/**
 * Núcleo transacional do estoque (registrar movimento, resolver produto,
 * reverter estoque no cancelamento). Deliberadamente sem `"use server"`:
 * cada função exportada de um arquivo `"use server"` é, em tese, alcançável
 * como uma Server Action via POST direto (ver
 * node_modules/next/dist/docs/01-app/02-guides/data-security.md), e algumas
 * destas (`reverterEstoqueDaConta`) recebem `empresaId` como parâmetro em vez
 * de tirar da sessão — seguro só porque hoje quem chama já validou a sessão
 * antes (`estoqueActions.ts`, `itensProdutoActions.ts`, `contasActions.ts`).
 * Sem essa diretiva, essas funções nunca entram no manifesto de Server
 * Actions do cliente, não importa o que o bundler decida incluir — só
 * chamáveis de outro código de servidor. Fica em `services/data/server/`
 * (não em `src/lib/`) só para caber na exceção do lint de acesso ao Prisma
 * (ver eslint.config.mjs), não porque seja uma Action.
 */

export class SaldoInsuficienteError extends Error {
  constructor(public readonly saldoAtual: number) {
    super(`SALDO_INSUFICIENTE:${saldoAtual}`);
  }
}

export class SaldoDivergenteError extends Error {
  constructor(public readonly saldoAtual: number) {
    super(`SALDO_MUDOU:${saldoAtual}`);
  }
}

export function paraProduto(registro: {
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

export function paraMovimento(registro: {
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

export interface ParametrosMovimento {
  produtoId: string;
  obraId: string;
  tipo: TipoMovimentoEstoque;
  /** Para "ajuste", é o saldo final desejado (não a diferença) — ver RF-04. */
  quantidadeInformada: number;
  /** Só para "ajuste" — saldo que a UI mostrou, ver definirSaldo(). */
  saldoEsperado?: number;
  valorUnitario?: number;
  origem: "manual" | "item_produto" | "estorno";
  itemProdutoId?: string;
  lancadoPor: string;
  observacao?: string;
}

/**
 * Núcleo transacional. Recebe `tx` em vez de abrir a própria transação para
 * poder compor com outras escritas na mesma transação — usado por
 * `criarItensProdutoEmLote` (Fase 5.2: entrada automática por item de nota
 * fiscal) e por `reverterEstoqueDaConta` (RF-07), além do formulário manual
 * via `registrarMovimentoInterno` abaixo.
 */
export async function registrarMovimentoComTx(
  tx: Prisma.TransactionClient,
  empresaId: string,
  p: ParametrosMovimento,
): Promise<MovimentoEstoque> {
  const agora = new Date().toISOString();
  // Guardamos sempre o que foi informado — para "ajuste" isso já é o saldo
  // final (não a diferença), então o histórico mostra "Ajuste para X" com o
  // mesmo número informado (ver HistoricoMovimentos).
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
}

/** Abre a própria transação — usado pelo formulário manual e por `reverterEstoqueDaConta`. */
export async function registrarMovimentoInterno(empresaId: string, p: ParametrosMovimento): Promise<MovimentoEstoque> {
  return prisma.$transaction((tx) => registrarMovimentoComTx(tx, empresaId, p));
}

/**
 * Acha um Produto do catálogo pela descrição (mesma normalização usada em
 * `historicoPrecoPorDescricao`, para "Cimento CP2" e "cimento cp2" caírem no
 * mesmo produto) ou cria um novo — mesmo padrão de `resolverFornecedor`
 * (sem exigir confirmação manual). Roda dentro da transação do chamador para
 * que a criação do Produto e o registro do estoque sejam atômicos com o
 * resto do lote (Fase 5.2, RF-06). Corrida entre dois lotes concorrentes
 * criando o "mesmo" produto novo é uma duplicidade ocasional aceita, mesmo
 * risco que `resolverFornecedor` já assume.
 */
export async function resolverProdutoComTx(
  tx: Prisma.TransactionClient,
  empresaId: string,
  nome: string,
): Promise<{ id: string }> {
  const nomeTratado = nome.trim();
  const alvo = normalizarDescricao(nomeTratado);
  const candidatos = await tx.produto.findMany({ where: { empresaId }, select: { id: true, nome: true } });
  const existente = candidatos.find((p) => normalizarDescricao(p.nome) === alvo);
  if (existente) return { id: existente.id };

  const agora = new Date().toISOString();
  const criado = await tx.produto.create({
    data: {
      empresaId,
      nome: nomeTratado || "Produto não identificado",
      criadoEm: agora,
      atualizadoEm: agora,
    },
  });
  return { id: criado.id };
}

/**
 * RF-07: ao cancelar uma conta, tenta reverter (saída) cada entrada de
 * estoque que veio de um item dessa conta (origem "item_produto"). Nunca
 * lança: se o saldo já foi consumido, conta o item como "não revertido" e
 * segue — quem chama decide como avisar (nunca bloquear o cancelamento por
 * causa do estoque). `empresaId` deve vir de uma sessão já validada por quem
 * chama — esta função não é uma Server Action (ver comentário no topo do
 * arquivo) e não é alcançável por um POST direto do client.
 */
export async function reverterEstoqueDaConta(
  empresaId: string,
  lancadoPor: string,
  contaFinanceiraId: string,
): Promise<{ revertidos: number; naoRevertidos: number }> {
  const movimentos = await prisma.movimentoEstoque.findMany({
    where: { empresaId, origem: "item_produto", tipo: "entrada", itemProduto: { contaFinanceiraId } },
  });

  let revertidos = 0;
  let naoRevertidos = 0;
  for (const mov of movimentos) {
    try {
      await registrarMovimentoInterno(empresaId, {
        produtoId: mov.produtoId,
        obraId: mov.obraId,
        tipo: "saida",
        quantidadeInformada: mov.quantidade,
        origem: "estorno",
        itemProdutoId: mov.itemProdutoId ?? undefined,
        lancadoPor,
        observacao: "Estorno automático — conta cancelada",
      });
      revertidos++;
    } catch (erro) {
      if (erro instanceof SaldoInsuficienteError) {
        naoRevertidos++;
        continue;
      }
      throw erro;
    }
  }
  return { revertidos, naoRevertidos };
}
