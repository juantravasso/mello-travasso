"use server";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  BaixarContaInput,
  CancelarContaInput,
  ContaFinanceira,
  EventoHistorico,
  FiltrosContaFinanceira,
  NovaContaFinanceiraInput,
  TipoConta,
} from "@/types";

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

function paraWhere(filtros?: FiltrosContaFinanceira & { tipo?: TipoConta }): Prisma.ContaFinanceiraWhereInput {
  if (!filtros) return {};
  const where: Prisma.ContaFinanceiraWhereInput = {};
  if (filtros.tipo) where.tipo = filtros.tipo;
  if (filtros.obraId) where.obraId = filtros.obraId;
  if (filtros.status) where.status = filtros.status;
  if (filtros.categoria) where.categoria = filtros.categoria;
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

export async function listarContas(
  filtros?: FiltrosContaFinanceira & { tipo?: TipoConta },
): Promise<ContaFinanceira[]> {
  const registros = await prisma.contaFinanceira.findMany({
    where: paraWhere(filtros),
    orderBy: { dataVencimento: "desc" },
  });
  return registros.map(paraConta);
}

export async function obterContaPorId(id: string): Promise<ContaFinanceira | null> {
  const registro = await prisma.contaFinanceira.findUnique({ where: { id } });
  return registro ? paraConta(registro) : null;
}

export async function criarConta(input: NovaContaFinanceiraInput, usuario: string): Promise<ContaFinanceira> {
  const agora = new Date().toISOString();
  const { parcela, ...resto } = input;
  const registro = await prisma.contaFinanceira.create({
    data: {
      ...resto,
      parcelaNumero: parcela?.numero,
      parcelaTotal: parcela?.totalParcelas,
      status: "em_aberto",
      historico: [evento("criacao", usuario)] as unknown as Prisma.InputJsonValue,
      criadoEm: agora,
      atualizadoEm: agora,
    },
  });
  return paraConta(registro);
}

export async function atualizarConta(
  id: string,
  input: Partial<NovaContaFinanceiraInput>,
  usuario: string,
): Promise<ContaFinanceira> {
  const existente = await prisma.contaFinanceira.findUniqueOrThrow({ where: { id } });
  if (existente.status !== "em_aberto") {
    throw new Error("Só é possível editar lançamentos em aberto.");
  }
  const { parcela, ...resto } = input;
  const historicoAtual = (existente.historico as unknown as EventoHistorico[]) ?? [];
  const registro = await prisma.contaFinanceira.update({
    where: { id },
    data: {
      ...resto,
      ...(parcela ? { parcelaNumero: parcela.numero, parcelaTotal: parcela.totalParcelas } : {}),
      historico: [...historicoAtual, evento("edicao", usuario)] as unknown as Prisma.InputJsonValue,
      atualizadoEm: new Date().toISOString(),
    },
  });
  return paraConta(registro);
}

export async function baixarConta(input: BaixarContaInput): Promise<ContaFinanceira> {
  const existente = await prisma.contaFinanceira.findUniqueOrThrow({ where: { id: input.contaId } });
  const historicoAtual = (existente.historico as unknown as EventoHistorico[]) ?? [];
  const registro = await prisma.contaFinanceira.update({
    where: { id: input.contaId },
    data: {
      status: "baixada",
      dataBaixa: input.dataBaixa,
      historico: [...historicoAtual, evento("baixa", input.usuario)] as unknown as Prisma.InputJsonValue,
      atualizadoEm: new Date().toISOString(),
    },
  });
  return paraConta(registro);
}

export async function cancelarConta(input: CancelarContaInput): Promise<ContaFinanceira> {
  const existente = await prisma.contaFinanceira.findUniqueOrThrow({ where: { id: input.contaId } });
  if (existente.status !== "em_aberto") {
    throw new Error("Só é possível cancelar lançamentos em aberto.");
  }
  const historicoAtual = (existente.historico as unknown as EventoHistorico[]) ?? [];
  const registro = await prisma.contaFinanceira.update({
    where: { id: input.contaId },
    data: {
      status: "cancelada",
      motivoCancelamento: input.motivo,
      historico: [...historicoAtual, evento("cancelamento", input.usuario, input.motivo)] as unknown as Prisma.InputJsonValue,
      atualizadoEm: new Date().toISOString(),
    },
  });
  return paraConta(registro);
}
