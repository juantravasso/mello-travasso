"use server";

import { prisma } from "@/lib/prisma";
import type { NovaOpcaoPersonalizadaInput, OpcaoPersonalizada, TipoConta } from "@/types";

function paraOpcao(registro: { id: string; rotulo: string; criadoEm: string }): OpcaoPersonalizada {
  return { id: registro.id, rotulo: registro.rotulo, criadoEm: registro.criadoEm };
}

export async function listarCategoriasPersonalizadas(tipo: TipoConta): Promise<OpcaoPersonalizada[]> {
  const registros = await prisma.categoriaPersonalizada.findMany({
    where: { tipoConta: tipo },
    orderBy: { criadoEm: "asc" },
  });
  return registros.map(paraOpcao);
}

export async function criarCategoriaPersonalizada(
  tipo: TipoConta,
  input: NovaOpcaoPersonalizadaInput,
): Promise<OpcaoPersonalizada> {
  const registro = await prisma.categoriaPersonalizada.create({
    data: { tipoConta: tipo, rotulo: input.rotulo, criadoEm: new Date().toISOString() },
  });
  return paraOpcao(registro);
}

export async function listarFormasPagamentoPersonalizadas(): Promise<OpcaoPersonalizada[]> {
  const registros = await prisma.formaPagamentoPersonalizada.findMany({ orderBy: { criadoEm: "asc" } });
  return registros.map(paraOpcao);
}

export async function criarFormaPagamentoPersonalizada(
  input: NovaOpcaoPersonalizadaInput,
): Promise<OpcaoPersonalizada> {
  const registro = await prisma.formaPagamentoPersonalizada.create({
    data: { rotulo: input.rotulo, criadoEm: new Date().toISOString() },
  });
  return paraOpcao(registro);
}
