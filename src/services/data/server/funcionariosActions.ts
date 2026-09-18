"use server";

import { prisma } from "@/lib/prisma";
import type { FiltrosFuncionario, Funcionario, NovoFuncionarioInput, StatusFuncionario } from "@/types";

function paraFuncionario(registro: {
  id: string;
  nome: string;
  cargo: string;
  telefone: string | null;
  email: string | null;
  cpf: string | null;
  dataAdmissao: string;
  obraId: string | null;
  salario: number | null;
  status: string;
  criadoEm: string;
  atualizadoEm: string;
}): Funcionario {
  return {
    id: registro.id,
    nome: registro.nome,
    cargo: registro.cargo,
    telefone: registro.telefone ?? undefined,
    email: registro.email ?? undefined,
    cpf: registro.cpf ?? undefined,
    dataAdmissao: registro.dataAdmissao,
    obraId: registro.obraId ?? undefined,
    salario: registro.salario ?? undefined,
    status: registro.status as StatusFuncionario,
    criadoEm: registro.criadoEm,
    atualizadoEm: registro.atualizadoEm,
  };
}

export async function listarFuncionarios(filtros?: FiltrosFuncionario): Promise<Funcionario[]> {
  const registros = await prisma.funcionario.findMany({
    where: {
      obraId: filtros?.obraId,
      status: filtros?.status,
      ...(filtros?.busca
        ? {
            OR: [
              { nome: { contains: filtros.busca, mode: "insensitive" } },
              { cargo: { contains: filtros.busca, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { nome: "asc" },
  });
  return registros.map(paraFuncionario);
}

export async function obterFuncionarioPorId(id: string): Promise<Funcionario | null> {
  const registro = await prisma.funcionario.findUnique({ where: { id } });
  return registro ? paraFuncionario(registro) : null;
}

export async function criarFuncionario(input: NovoFuncionarioInput): Promise<Funcionario> {
  const agora = new Date().toISOString();
  const registro = await prisma.funcionario.create({
    data: { ...input, status: "ativo", criadoEm: agora, atualizadoEm: agora },
  });
  return paraFuncionario(registro);
}

export async function atualizarFuncionario(id: string, input: Partial<NovoFuncionarioInput>): Promise<Funcionario> {
  const registro = await prisma.funcionario.update({
    where: { id },
    data: { ...input, atualizadoEm: new Date().toISOString() },
  });
  return paraFuncionario(registro);
}

export async function definirStatusFuncionario(id: string, status: StatusFuncionario): Promise<Funcionario> {
  const registro = await prisma.funcionario.update({
    where: { id },
    data: { status, atualizadoEm: new Date().toISOString() },
  });
  return paraFuncionario(registro);
}
