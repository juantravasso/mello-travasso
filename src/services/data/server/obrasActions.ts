"use server";

import { prisma } from "@/lib/prisma";
import { exigirEscritaAction, exigirSessaoAction } from "@/lib/auth/dal";
import { novaObraSchema, atualizarObraSchema } from "@/lib/validacao/obras";
import type { NovaObraInput, Obra } from "@/types";

function paraObra(registro: {
  id: string;
  nome: string;
  cliente: string;
  endereco: string | null;
  status: string;
  dataInicio: string;
  dataFim: string | null;
  orcamentoPrevisto: number | null;
  observacoes: string | null;
  criadoEm: string;
  atualizadoEm: string;
}): Obra {
  return {
    id: registro.id,
    nome: registro.nome,
    cliente: registro.cliente,
    endereco: registro.endereco ?? undefined,
    status: registro.status as Obra["status"],
    dataInicio: registro.dataInicio,
    dataFim: registro.dataFim ?? undefined,
    orcamentoPrevisto: registro.orcamentoPrevisto ?? undefined,
    observacoes: registro.observacoes ?? undefined,
    criadoEm: registro.criadoEm,
    atualizadoEm: registro.atualizadoEm,
  };
}

export async function listarObras(): Promise<Obra[]> {
  const sessao = await exigirSessaoAction();
  const registros = await prisma.obra.findMany({
    where: { empresaId: sessao.empresaId },
    orderBy: { criadoEm: "desc" },
  });
  return registros.map(paraObra);
}

export async function obterObraPorId(id: string): Promise<Obra | null> {
  const sessao = await exigirSessaoAction();
  const registro = await prisma.obra.findFirst({ where: { id, empresaId: sessao.empresaId } });
  return registro ? paraObra(registro) : null;
}

export async function criarObra(input: NovaObraInput): Promise<Obra> {
  const sessao = await exigirEscritaAction();
  const parsed = novaObraSchema.safeParse(input);
  if (!parsed.success) throw new Error("Dados inválidos.");

  const agora = new Date().toISOString();
  const registro = await prisma.obra.create({
    data: { ...parsed.data, empresaId: sessao.empresaId, criadoEm: agora, atualizadoEm: agora },
  });
  return paraObra(registro);
}

export async function atualizarObra(id: string, input: Partial<NovaObraInput>): Promise<Obra> {
  const sessao = await exigirEscritaAction();
  const parsed = atualizarObraSchema.safeParse(input);
  if (!parsed.success) throw new Error("Dados inválidos.");

  // updateMany (não update) com empresaId no where: mesmo que o schema já
  // rejeite um "empresaId" forjado no corpo, o where também escopa a
  // operação — segunda barreira contra IDOR/reatribuição entre empresas.
  const resultado = await prisma.obra.updateMany({
    where: { id, empresaId: sessao.empresaId },
    data: { ...parsed.data, atualizadoEm: new Date().toISOString() },
  });
  if (resultado.count === 0) throw new Error("Obra não encontrada.");

  const registro = await prisma.obra.findFirstOrThrow({ where: { id, empresaId: sessao.empresaId } });
  return paraObra(registro);
}
