"use server";

import { prisma } from "@/lib/prisma";
import { exigirGestaoEscritaAction, exigirGestaoAction } from "@/lib/auth/dal";
import { novaOpcaoPersonalizadaSchema, tipoContaSchema } from "@/lib/validacao/catalogo";
import type { NovaOpcaoPersonalizadaInput, OpcaoPersonalizada, TipoConta } from "@/types";

function paraOpcao(registro: { id: string; rotulo: string; criadoEm: string }): OpcaoPersonalizada {
  return { id: registro.id, rotulo: registro.rotulo, criadoEm: registro.criadoEm };
}

export async function listarCategoriasPersonalizadas(tipo: TipoConta): Promise<OpcaoPersonalizada[]> {
  const sessao = await exigirGestaoAction();
  const tipoParsed = tipoContaSchema.safeParse(tipo);
  if (!tipoParsed.success) throw new Error("Tipo inválido.");
  const tipoValido = tipoParsed.data;
  const registros = await prisma.categoriaPersonalizada.findMany({
    where: { tipoConta: tipoValido, empresaId: sessao.empresaId },
    orderBy: { criadoEm: "asc" },
  });
  return registros.map(paraOpcao);
}

export async function criarCategoriaPersonalizada(
  tipo: TipoConta,
  input: NovaOpcaoPersonalizadaInput,
): Promise<OpcaoPersonalizada> {
  const sessao = await exigirGestaoEscritaAction();
  const tipoParsed = tipoContaSchema.safeParse(tipo);
  if (!tipoParsed.success) throw new Error("Tipo inválido.");
  const tipoValido = tipoParsed.data;
  const parsed = novaOpcaoPersonalizadaSchema.safeParse(input);
  if (!parsed.success) throw new Error("Dados inválidos.");

  const registro = await prisma.categoriaPersonalizada.create({
    data: { tipoConta: tipoValido, rotulo: parsed.data.rotulo, empresaId: sessao.empresaId, criadoEm: new Date().toISOString() },
  });
  return paraOpcao(registro);
}

export async function listarFormasPagamentoPersonalizadas(): Promise<OpcaoPersonalizada[]> {
  const sessao = await exigirGestaoAction();
  const registros = await prisma.formaPagamentoPersonalizada.findMany({
    where: { empresaId: sessao.empresaId },
    orderBy: { criadoEm: "asc" },
  });
  return registros.map(paraOpcao);
}

export async function criarFormaPagamentoPersonalizada(
  input: NovaOpcaoPersonalizadaInput,
): Promise<OpcaoPersonalizada> {
  const sessao = await exigirGestaoEscritaAction();
  const parsed = novaOpcaoPersonalizadaSchema.safeParse(input);
  if (!parsed.success) throw new Error("Dados inválidos.");

  const registro = await prisma.formaPagamentoPersonalizada.create({
    data: { rotulo: parsed.data.rotulo, empresaId: sessao.empresaId, criadoEm: new Date().toISOString() },
  });
  return paraOpcao(registro);
}
