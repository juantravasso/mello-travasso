"use server";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { exigirGestaoEscritaAction, exigirGestaoAction } from "@/lib/auth/dal";
import { ACESSO, temAlgumModulo, type AcessoDaPessoa, type ModuloChave } from "@/lib/auth/modulos";
import {
  novaContaSchema,
  atualizarContaSchema,
  baixarContaSchema,
  cancelarContaSchema,
} from "@/lib/validacao/contas";
import type {
  BaixarContaInput,
  CancelarContaInput,
  CompromissoItem,
  ContaFinanceira,
  EventoHistorico,
  FiltrosContaFinanceira,
  NovaContaFinanceiraInput,
  ResultadoCancelamentoConta,
  TipoConta,
} from "@/types";
import { dataDaBaixaAutomatica, deveBaixarSozinha, proximoVencimento } from "@/lib/formaPagamento";
import { reverterEstoqueDaConta } from "./estoqueCore.server";
import { configuracaoDaForma } from "./formaPagamentoCore.server";

// Toda leitura traz o rateio: notas divididas entre projetos e Depósito precisam dele para os custos fecharem.
const comRateios = { rateios: true } satisfies Prisma.ContaFinanceiraInclude;
type ContaRegistro = Prisma.ContaFinanceiraGetPayload<{ include: typeof comRateios }>;

function paraConta(registro: ContaRegistro): ContaFinanceira {
  return {
    id: registro.id,
    tipo: registro.tipo as ContaFinanceira["tipo"],
    obraId: registro.obraId,
    valor: registro.valor,
    rateios: registro.rateios.length > 0 ? registro.rateios.map((r) => ({ obraId: r.obraId, valor: r.valor })) : undefined,
    dataLancamento: registro.dataLancamento,
    dataVencimento: registro.dataVencimento,
    dataBaixa: registro.dataBaixa ?? undefined,
    status: registro.status as ContaFinanceira["status"],
    favorecidoOuCliente: registro.favorecidoOuCliente,
    fornecedorId: registro.fornecedorId ?? undefined,
    descricao: registro.descricao,
    categoria: registro.categoria ?? undefined,
    formaPagamento: registro.formaPagamento ?? undefined,
    observacao: registro.observacao ?? undefined,
    comprovanteUrl: registro.comprovanteUrl,
    origemNotaFiscal: registro.origemNotaFiscal,
    notaFiscalId: registro.notaFiscalId ?? undefined,
    precisaCompletarCadastro: registro.precisaCompletarCadastro,
    parcelamentoId: registro.parcelamentoId ?? undefined,
    parcela:
      registro.parcelaNumero != null && registro.parcelaTotal != null
        ? { numero: registro.parcelaNumero, totalParcelas: registro.parcelaTotal }
        : undefined,
    motivoCancelamento: registro.motivoCancelamento ?? undefined,
    historico: (registro.historico as unknown as EventoHistorico[]) ?? [],
    criadoEm: registro.criadoEm,
    atualizadoEm: registro.atualizadoEm,
  };
}

function evento(tipo: EventoHistorico["tipo"], usuario: string, detalhes?: string): EventoHistorico {
  return { id: crypto.randomUUID(), tipo, usuario, data: new Date().toISOString(), detalhes };
}

function paraWhere(
  empresaId: string,
  filtros?: FiltrosContaFinanceira & { tipo?: TipoConta },
): Prisma.ContaFinanceiraWhereInput {
  const where: Prisma.ContaFinanceiraWhereInput = { empresaId };
  if (!filtros) return where;
  if (filtros.tipo) where.tipo = filtros.tipo;
  // Uma nota dividida aparece em cada projeto que tem parte dela, não só no principal.
  if (filtros.obraId) where.AND = [{ OR: [{ obraId: filtros.obraId }, { rateios: { some: { obraId: filtros.obraId } } }] }];
  if (filtros.status) where.status = filtros.status;
  if (filtros.categoria) where.categoria = filtros.categoria;
  if (filtros.fornecedorId) where.fornecedorId = filtros.fornecedorId;
  if (filtros.precisaCompletarCadastro !== undefined) {
    where.precisaCompletarCadastro = filtros.precisaCompletarCadastro;
  }
  if (filtros.dataInicio || filtros.dataFim) {
    where.dataVencimento = {
      ...(filtros.dataInicio ? { gte: filtros.dataInicio } : {}),
      ...(filtros.dataFim ? { lte: filtros.dataFim } : {}),
    };
  }
  if (filtros.busca) {
    where.OR = [
      { favorecidoOuCliente: { contains: filtros.busca, mode: "insensitive" } },
      { descricao: { contains: filtros.busca, mode: "insensitive" } },
    ];
  }
  return where;
}

/** Confere que obraId (e fornecedorId, se informado) pertencem à empresa da sessão antes de gravar. */
async function validarReferencias(empresaId: string, obraId: string, tipo: TipoConta, fornecedorId?: string): Promise<void> {
  const obra = await prisma.obra.findFirst({ where: { id: obraId, empresaId } });
  if (!obra) throw new Error("Projeto não encontrado.");
  // O Depósito recebe compras (contas a pagar); não faz sentido receber dinheiro nele.
  if (obra.ehDeposito && tipo === "receber") throw new Error("Contas a receber precisam de um projeto.");
  if (fornecedorId) {
    const fornecedor = await prisma.fornecedor.findFirst({ where: { id: fornecedorId, empresaId } });
    if (!fornecedor) throw new Error("Fornecedor não encontrado.");
  }
}

// Contas a pagar e a receber são módulos separados: quem só tem um não lê nem altera o outro. Quem usa o dado em
// outra tela (dashboard, projetos, captura) lê o que essa tela precisa, mas só lança no módulo certo.
const LEITURA: Record<TipoConta, readonly ModuloChave[]> = { pagar: ACESSO.contasPagarLer, receber: ACESSO.contasReceberLer };
const ESCRITA: Record<TipoConta, readonly ModuloChave[]> = { pagar: ACESSO.contasPagarEscrever, receber: ACESSO.contasReceberEscrever };

function tiposLiberados(pessoa: AcessoDaPessoa): TipoConta[] {
  return (["pagar", "receber"] as const).filter((t) => temAlgumModulo(pessoa, LEITURA[t]));
}

function exigirTipo(pessoa: AcessoDaPessoa, tipo: TipoConta, regra: Record<TipoConta, readonly ModuloChave[]>): void {
  if (!temAlgumModulo(pessoa, regra[tipo])) throw new Error("SEM_ACESSO_MODULO");
}

export async function listarContas(
  filtros?: FiltrosContaFinanceira & { tipo?: TipoConta },
): Promise<ContaFinanceira[]> {
  const sessao = await exigirGestaoAction(...ACESSO.contasPagarLer, ...ACESSO.contasReceberLer);
  const tipos = tiposLiberados(sessao);
  if (filtros?.tipo && !tipos.includes(filtros.tipo)) throw new Error("SEM_ACESSO_MODULO");
  const where = paraWhere(sessao.empresaId, filtros);
  where.tipo = filtros?.tipo ?? { in: tipos };
  const registros = await prisma.contaFinanceira.findMany({
    where,
    orderBy: { dataVencimento: "desc" },
    include: comRateios,
  });
  return registros.map(paraConta);
}

/**
 * Contas em aberto que vencem no período, no formato do calendário. Só as dos tipos que a pessoa pode ver (pagar e/ou
 * receber) e nunca as baixadas ou canceladas: o calendário lembra o que ainda precisa ser pago ou recebido.
 */
export async function listarContasNoCalendario(de: string, ate: string): Promise<CompromissoItem[]> {
  const sessao = await exigirGestaoAction(...ACESSO.contasPagarLer, ...ACESSO.contasReceberLer);
  const formato = /^d{4}-d{2}-d{2}$/;
  if (!formato.test(de) || !formato.test(ate)) return [];
  const tipos = tiposLiberados(sessao);
  if (tipos.length === 0) return [];
  const registros = await prisma.contaFinanceira.findMany({
    where: { empresaId: sessao.empresaId, status: "em_aberto", tipo: { in: tipos }, dataVencimento: { gte: de, lte: ate } },
    orderBy: [{ dataVencimento: "asc" }, { criadoEm: "asc" }],
    take: 500,
  });
  // "Vencida" pelo dia de hoje no Brasil (o servidor roda em UTC e viraria o dia à noite).
  const hoje = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
  const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  return registros.map((c) => {
    const pagar = c.tipo === "pagar";
    return {
      id: `conta-${c.id}`,
      titulo: `${pagar ? "A pagar" : "A receber"}: ${c.favorecidoOuCliente} · ${moeda(c.valor)}`,
      descricao: c.descricao,
      categoria: "financeiro" as const,
      status: "agendado" as const,
      data: c.dataVencimento,
      diaInteiro: true,
      criadoPor: { id: "", nome: "" },
      participantes: [],
      souCriador: true,
      conta: { tipo: c.tipo as "pagar" | "receber", href: `/contas-a-${pagar ? "pagar" : "receber"}/${c.id}`, valor: c.valor, atrasada: c.dataVencimento < hoje },
    };
  });
}

export async function obterContaPorId(id: string): Promise<ContaFinanceira | null> {
  const sessao = await exigirGestaoAction(...ACESSO.contasPagarLer, ...ACESSO.contasReceberLer);
  const registro = await prisma.contaFinanceira.findFirst({
    where: { id, empresaId: sessao.empresaId, tipo: { in: tiposLiberados(sessao) } },
    include: comRateios,
  });
  return registro ? paraConta(registro) : null;
}

export async function criarConta(input: NovaContaFinanceiraInput): Promise<ContaFinanceira> {
  const sessao = await exigirGestaoEscritaAction(...ACESSO.contasPagarEscrever, ...ACESSO.contasReceberEscrever);
  const parsed = novaContaSchema.safeParse(input);
  if (!parsed.success) throw new Error("Dados inválidos.");
  exigirTipo(sessao, parsed.data.tipo, ESCRITA);
  await validarReferencias(sessao.empresaId, parsed.data.obraId, parsed.data.tipo, parsed.data.fornecedorId);

  const agora = new Date().toISOString();
  const { parcela, ...resto } = parsed.data;
  // Forma de pagamento configurada pela empresa: baixa automática (dinheiro, PIX…) ou dia fixo de vencimento (cartão).
  const configuracao = await configuracaoDaForma(prisma, sessao.empresaId, resto.formaPagamento);
  const baixaSozinha = !resto.precisaCompletarCadastro && deveBaixarSozinha({ categoria: resto.categoria, formaPagamento: resto.formaPagamento, parcelada: Boolean(parcela) }, configuracao);
  // Vencimento deixado no padrão (o próprio dia do lançamento) ganha o dia fixo da forma; data escolhida à mão vale.
  const dataVencimento =
    !baixaSozinha && !parcela && configuracao.diaVencimento && resto.dataVencimento === resto.dataLancamento
      ? proximoVencimento(resto.dataLancamento, configuracao.diaVencimento)
      : resto.dataVencimento;
  const registro = await prisma.contaFinanceira.create({
    data: {
      ...resto,
      dataVencimento,
      empresaId: sessao.empresaId,
      parcelaNumero: parcela?.numero,
      parcelaTotal: parcela?.totalParcelas,
      status: baixaSozinha ? "baixada" : "em_aberto",
      dataBaixa: baixaSozinha ? dataDaBaixaAutomatica(dataVencimento, agora.slice(0, 10)) : undefined,
      historico: [evento("criacao", sessao.nome), ...(baixaSozinha ? [evento("baixa", sessao.nome, "Baixa automática pela forma de pagamento")] : [])] as unknown as Prisma.InputJsonValue,
      criadoEm: agora,
      atualizadoEm: agora,
    },
    include: comRateios,
  });
  return paraConta(registro);
}

export async function atualizarConta(
  id: string,
  input: Partial<NovaContaFinanceiraInput>,
): Promise<ContaFinanceira> {
  const sessao = await exigirGestaoEscritaAction(...ACESSO.contasPagarEscrever, ...ACESSO.contasReceberEscrever);
  const parsed = atualizarContaSchema.safeParse(input);
  if (!parsed.success) throw new Error("Dados inválidos.");

  const existente = await prisma.contaFinanceira.findFirst({ where: { id, empresaId: sessao.empresaId }, include: comRateios });
  if (!existente) throw new Error("Conta não encontrada.");
  exigirTipo(sessao, existente.tipo, ESCRITA);
  if (
    existente.rateios.length > 0 &&
    ((parsed.data.obraId !== undefined && parsed.data.obraId !== existente.obraId) ||
      (parsed.data.valor !== undefined && parsed.data.valor !== existente.valor))
  ) {
    throw new Error("Esta nota está dividida entre projetos: para mudar o valor ou o projeto, cancele e lance de novo.");
  }
  if (parsed.data.tipo) exigirTipo(sessao, parsed.data.tipo, ESCRITA);
  if (existente.status !== "em_aberto") {
    throw new Error("Só é possível editar lançamentos em aberto.");
  }
  if (parsed.data.obraId || parsed.data.fornecedorId) {
    await validarReferencias(
      sessao.empresaId,
      parsed.data.obraId ?? existente.obraId,
      (parsed.data.tipo ?? existente.tipo) as TipoConta,
      parsed.data.fornecedorId,
    );
  }

  const { parcela, ...resto } = parsed.data;
  const historicoAtual = (existente.historico as unknown as EventoHistorico[]) ?? [];
  // Ao completar o cadastro de uma conta em aberto com forma de baixa automática (dinheiro, PIX…), ela já é dada como paga.
  const categoriaFinal = resto.categoria ?? existente.categoria;
  const formaFinal = resto.formaPagamento ?? existente.formaPagamento;
  const configuracao = await configuracaoDaForma(prisma, sessao.empresaId, formaFinal);
  const baixaSozinha = deveBaixarSozinha({ categoria: categoriaFinal, formaPagamento: formaFinal, parcelada: existente.parcelaNumero !== null || Boolean(parcela) }, configuracao);
  const agoraIso = new Date().toISOString();
  const resultado = await prisma.contaFinanceira.updateMany({
    where: { id, empresaId: sessao.empresaId },
    data: {
      ...resto,
      ...(parcela ? { parcelaNumero: parcela.numero, parcelaTotal: parcela.totalParcelas } : {}),
      ...(baixaSozinha ? { status: "baixada", dataBaixa: dataDaBaixaAutomatica(resto.dataVencimento ?? existente.dataVencimento, agoraIso.slice(0, 10)) } : {}),
      historico: [...historicoAtual, evento("edicao", sessao.nome), ...(baixaSozinha ? [evento("baixa", sessao.nome, "Baixa automática pela forma de pagamento")] : [])] as unknown as Prisma.InputJsonValue,
      atualizadoEm: agoraIso,
    },
  });
  if (resultado.count === 0) throw new Error("Conta não encontrada.");

  const registro = await prisma.contaFinanceira.findFirstOrThrow({ where: { id, empresaId: sessao.empresaId }, include: comRateios });
  return paraConta(registro);
}

export async function baixarConta(input: BaixarContaInput): Promise<ContaFinanceira> {
  const sessao = await exigirGestaoEscritaAction(...ACESSO.contasPagarEscrever, ...ACESSO.contasReceberEscrever);
  const parsed = baixarContaSchema.safeParse(input);
  if (!parsed.success) throw new Error("Dados inválidos.");

  const existente = await prisma.contaFinanceira.findFirst({
    where: { id: parsed.data.contaId, empresaId: sessao.empresaId },
  });
  if (!existente) throw new Error("Conta não encontrada.");
  exigirTipo(sessao, existente.tipo, ESCRITA);

  const historicoAtual = (existente.historico as unknown as EventoHistorico[]) ?? [];
  const resultado = await prisma.contaFinanceira.updateMany({
    where: { id: parsed.data.contaId, empresaId: sessao.empresaId },
    data: {
      status: "baixada",
      dataBaixa: parsed.data.dataBaixa,
      historico: [...historicoAtual, evento("baixa", sessao.nome)] as unknown as Prisma.InputJsonValue,
      atualizadoEm: new Date().toISOString(),
    },
  });
  if (resultado.count === 0) throw new Error("Conta não encontrada.");

  const registro = await prisma.contaFinanceira.findFirstOrThrow({
    where: { id: parsed.data.contaId, empresaId: sessao.empresaId },
    include: comRateios,
  });
  return paraConta(registro);
}

export async function cancelarConta(input: CancelarContaInput): Promise<ResultadoCancelamentoConta> {
  const sessao = await exigirGestaoEscritaAction(...ACESSO.contasPagarEscrever, ...ACESSO.contasReceberEscrever);
  const parsed = cancelarContaSchema.safeParse(input);
  if (!parsed.success) throw new Error("Dados inválidos.");

  const existente = await prisma.contaFinanceira.findFirst({
    where: { id: parsed.data.contaId, empresaId: sessao.empresaId },
  });
  if (!existente) throw new Error("Conta não encontrada.");
  exigirTipo(sessao, existente.tipo, ESCRITA);
  if (existente.status !== "em_aberto") {
    throw new Error("Só é possível cancelar lançamentos em aberto.");
  }

  const historicoAtual = (existente.historico as unknown as EventoHistorico[]) ?? [];
  const resultado = await prisma.contaFinanceira.updateMany({
    // status: "em_aberto" no where (não só no pré-check acima) fecha a
    // corrida de dois cancelamentos concorrentes da mesma conta: sem isso,
    // os dois passariam no pré-check e os dois chamariam
    // reverterEstoqueDaConta, estornando o mesmo estoque duas vezes.
    where: { id: parsed.data.contaId, empresaId: sessao.empresaId, status: "em_aberto" },
    data: {
      status: "cancelada",
      motivoCancelamento: parsed.data.motivo,
      historico: [...historicoAtual, evento("cancelamento", sessao.nome, parsed.data.motivo)] as unknown as Prisma.InputJsonValue,
      atualizadoEm: new Date().toISOString(),
    },
  });
  if (resultado.count === 0) throw new Error("Conta não encontrada ou já não está em aberto.");

  // RF-07 (PRD de estoque): melhor esforço, nunca bloqueia o cancelamento —
  // a conta já foi marcada como cancelada acima; se reverter o estoque falhar
  // por qualquer motivo (não só saldo insuficiente), avisa em vez de deixar o
  // cliente sem resposta com a conta já cancelada no banco.
  let avisoEstoque: string | undefined;
  try {
    const { naoRevertidos } = await reverterEstoqueDaConta(sessao.empresaId, sessao.nome, parsed.data.contaId);
    if (naoRevertidos > 0) {
      avisoEstoque = "Estoque já consumido neste projeto — ajuste manual necessário para os itens desta conta.";
    }
  } catch (erro) {
    console.error("[contasActions] falha ao reverter estoque no cancelamento", parsed.data.contaId, erro);
    avisoEstoque = "Não foi possível conferir o estoque automaticamente — confira manualmente.";
  }

  const registro = await prisma.contaFinanceira.findFirstOrThrow({
    where: { id: parsed.data.contaId, empresaId: sessao.empresaId },
    include: comRateios,
  });
  return {
    conta: paraConta(registro),
    avisoEstoque,
  };
}
