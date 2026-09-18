"use server";

import { prisma } from "@/lib/prisma";
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
  const registros = await prisma.obra.findMany({ orderBy: { criadoEm: "desc" } });
  return registros.map(paraObra);
}

export async function obterObraPorId(id: string): Promise<Obra | null> {
  const registro = await prisma.obra.findUnique({ where: { id } });
  return registro ? paraObra(registro) : null;
}

export async function criarObra(input: NovaObraInput): Promise<Obra> {
  const agora = new Date().toISOString();
  const registro = await prisma.obra.create({
    data: { ...input, criadoEm: agora, atualizadoEm: agora },
  });
  return paraObra(registro);
}

export async function atualizarObra(id: string, input: Partial<NovaObraInput>): Promise<Obra> {
  const registro = await prisma.obra.update({
    where: { id },
    data: { ...input, atualizadoEm: new Date().toISOString() },
  });
  return paraObra(registro);
}
