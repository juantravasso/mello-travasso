"use server";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { exigirGestaoEscritaAction, exigirGestaoAction } from "@/lib/auth/dal";
import {
  novaContaSchema,
  atualizarContaSchema,
  baixarContaSchema,
  cancelarContaSchema,
} from "@/lib/validacao/contas";
import type {
  BaixarContaInput,
  CancelarContaInput,
  ContaFinanceira,
  EventoHistorico,
  FiltrosContaFinanceira,
  NovaContaFinanceiraInput,
  ResultadoCancelamentoConta,
  TipoConta,
} from "@/types";
import { reverterEstoqueDaConta } from "./estoqueCore.server";

type ContaRegistro = Prisma.ContaFinanceiraGetPayload<Record<string, never>>;

function paraConta(registro: ContaRegistro): ContaFinanceira {
  return {
    id: registro.id,
    tipo: registro.tipo as ContaFinanceira["tipo"],
    obraId: registro.obraId,
    valor: registro.valor,
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
  if (filtros.obraId) where.obraId = filtros.obraId;
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
async function validarReferencias(empresaId: string, obraId: string, fornecedorId?: string): Promise<void> {
  const obra = await prisma.obra.findFirst({ where: { id: obraId, empresaId } });
  if (!obra) throw new Error("Obra não encontrada.");
  if (fornecedorId) {
    const fornecedor = await prisma.fornecedor.findFirst({ where: { id: fornecedorId, empresaId } });
    if (!fornecedor) throw new Error("Fornecedor não encontrado.");
  }
}

export async function listarContas(
  filtros?: FiltrosContaFinanceira & { tipo?: TipoConta },
): Promise<ContaFinanceira[]> {
  const sessao = await exigirGestaoAction();
  const registros = await prisma.contaFinanceira.findMany({
    where: paraWhere(sessao.empresaId, filtros),
    orderBy: { dataVencimento: "desc" },
  });
  return registros.map(paraConta);
}

export async function obterContaPorId(id: string): Promise<ContaFinanceira | null> {
  const sessao = await exigirGestaoAction();
  const registro = await prisma.contaFinanceira.findFirst({ where: { id, empresaId: sessao.empresaId } });
  return registro ? paraConta(registro) : null;
}

export async function criarConta(input: NovaContaFinanceiraInput): Promise<ContaFinanceira> {
  const sessao = await exigirGestaoEscritaAction();
  const parsed = novaContaSchema.safeParse(input);
  if (!parsed.success) throw new Error("Dados inválidos.");
  await validarReferencias(sessao.empresaId, parsed.data.obraId, parsed.data.fornecedorId);

  const agora = new Date().toISOString();
  const { parcela, ...resto } = parsed.data;
  const registro = await prisma.contaFinanceira.create({
    data: {
      ...resto,
      empresaId: sessao.empresaId,
      parcelaNumero: parcela?.numero,
      parcelaTotal: parcela?.totalParcelas,
      status: "em_aberto",
      historico: [evento("criacao", sessao.nome)] as unknown as Prisma.InputJsonValue,
      criadoEm: agora,
      atualizadoEm: agora,
    },
  });
  return paraConta(registro);
}

export async function atualizarConta(
  id: string,
  input: Partial<NovaContaFinanceiraInput>,
): Promise<ContaFinanceira> {
  const sessao = await exigirGestaoEscritaAction();
  const parsed = atualizarContaSchema.safeParse(input);
  if (!parsed.success) throw new Error("Dados inválidos.");

  const existente = await prisma.contaFinanceira.findFirst({ where: { id, empresaId: sessao.empresaId } });
  if (!existente) throw new Error("Conta não encontrada.");
  if (existente.status !== "em_aberto") {
    throw new Error("Só é possível editar lançamentos em aberto.");
  }
  if (parsed.data.obraId || parsed.data.fornecedorId) {
    await validarReferencias(sessao.empresaId, parsed.data.obraId ?? existente.obraId, parsed.data.fornecedorId);
  }

  const { parcela, ...resto } = parsed.data;
  const historicoAtual = (existente.historico as unknown as EventoHistorico[]) ?? [];
  const resultado = await prisma.contaFinanceira.updateMany({
    where: { id, empresaId: sessao.empresaId },
    data: {
      ...resto,
      ...(parcela ? { parcelaNumero: parcela.numero, parcelaTotal: parcela.totalParcelas } : {}),
      historico: [...historicoAtual, evento("edicao", sessao.nome)] as unknown as Prisma.InputJsonValue,
      atualizadoEm: new Date().toISOString(),
    },
  });
  if (resultado.count === 0) throw new Error("Conta não encontrada.");

  const registro = await prisma.contaFinanceira.findFirstOrThrow({ where: { id, empresaId: sessao.empresaId } });
  return paraConta(registro);
}

export async function baixarConta(input: BaixarContaInput): Promise<ContaFinanceira> {
  const sessao = await exigirGestaoEscritaAction();
  const parsed = baixarContaSchema.safeParse(input);
  if (!parsed.success) throw new Error("Dados inválidos.");

  const existente = await prisma.contaFinanceira.findFirst({
    where: { id: parsed.data.contaId, empresaId: sessao.empresaId },
  });
  if (!existente) throw new Error("Conta não encontrada.");

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
  });
  return paraConta(registro);
}

export async function cancelarConta(input: CancelarContaInput): Promise<ResultadoCancelamentoConta> {
  const sessao = await exigirGestaoEscritaAction();
  const parsed = cancelarContaSchema.safeParse(input);
  if (!parsed.success) throw new Error("Dados inválidos.");

  const existente = await prisma.contaFinanceira.findFirst({
    where: { id: parsed.data.contaId, empresaId: sessao.empresaId },
  });
  if (!existente) throw new Error("Conta não encontrada.");
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
      avisoEstoque = "Estoque já consumido nesta obra — ajuste manual necessário para os itens desta conta.";
    }
  } catch (erro) {
    console.error("[contasActions] falha ao reverter estoque no cancelamento", parsed.data.contaId, erro);
    avisoEstoque = "Não foi possível conferir o estoque automaticamente — confira manualmente.";
  }

  const registro = await prisma.contaFinanceira.findFirstOrThrow({
    where: { id: parsed.data.contaId, empresaId: sessao.empresaId },
  });
  return {
    conta: paraConta(registro),
    avisoEstoque,
  };
}
