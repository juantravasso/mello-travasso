"use server";

import { prisma } from "@/lib/prisma";
import type { FiltrosFornecedor, Fornecedor, NovoFornecedorInput } from "@/types";

function paraFornecedor(registro: {
  id: string;
  nome: string;
  documento: string | null;
  telefone: string | null;
  email: string | null;
  observacao: string | null;
  criadoEm: string;
  atualizadoEm: string;
}): Fornecedor {
  return {
    id: registro.id,
    nome: registro.nome,
    documento: registro.documento ?? undefined,
    telefone: registro.telefone ?? undefined,
    email: registro.email ?? undefined,
    observacao: registro.observacao ?? undefined,
    criadoEm: registro.criadoEm,
    atualizadoEm: registro.atualizadoEm,
  };
}

export async function listarFornecedores(filtros?: FiltrosFornecedor): Promise<Fornecedor[]> {
  const registros = await prisma.fornecedor.findMany({
    where: filtros?.busca
      ? {
          OR: [
            { nome: { contains: filtros.busca, mode: "insensitive" } },
            { documento: { contains: filtros.busca, mode: "insensitive" } },
          ],
        }
      : {},
    orderBy: { nome: "asc" },
  });
  return registros.map(paraFornecedor);
}

export async function obterFornecedorPorId(id: string): Promise<Fornecedor | null> {
  const registro = await prisma.fornecedor.findUnique({ where: { id } });
  return registro ? paraFornecedor(registro) : null;
}

export async function criarFornecedor(input: NovoFornecedorInput): Promise<Fornecedor> {
  const agora = new Date().toISOString();
  const registro = await prisma.fornecedor.create({
    data: { ...input, criadoEm: agora, atualizadoEm: agora },
  });
  return paraFornecedor(registro);
}

export async function atualizarFornecedor(id: string, input: Partial<NovoFornecedorInput>): Promise<Fornecedor> {
  const registro = await prisma.fornecedor.update({
    where: { id },
    data: { ...input, atualizadoEm: new Date().toISOString() },
  });
  return paraFornecedor(registro);
}
