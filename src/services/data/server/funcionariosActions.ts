"use server";

import { prisma } from "@/lib/prisma";
import { exigirGestaoEscritaAction, exigirGestaoAction } from "@/lib/auth/dal";
import { novoFuncionarioSchema, atualizarFuncionarioSchema, statusFuncionarioSchema } from "@/lib/validacao/funcionarios";
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
  const sessao = await exigirGestaoAction();
  const registros = await prisma.funcionario.findMany({
    where: {
      empresaId: sessao.empresaId,
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
  const sessao = await exigirGestaoAction();
  const registro = await prisma.funcionario.findFirst({ where: { id, empresaId: sessao.empresaId } });
  return registro ? paraFuncionario(registro) : null;
}

async function validarObraDaEmpresa(obraId: string | undefined, empresaId: string): Promise<void> {
  if (!obraId) return;
  const obra = await prisma.obra.findFirst({ where: { id: obraId, empresaId } });
  if (!obra) throw new Error("Projeto não encontrado.");
}

export async function criarFuncionario(input: NovoFuncionarioInput): Promise<Funcionario> {
  const sessao = await exigirGestaoEscritaAction();
  const parsed = novoFuncionarioSchema.safeParse(input);
  if (!parsed.success) throw new Error("Dados inválidos.");
  await validarObraDaEmpresa(parsed.data.obraId, sessao.empresaId);

  const agora = new Date().toISOString();
  const registro = await prisma.funcionario.create({
    data: { ...parsed.data, empresaId: sessao.empresaId, status: "ativo", criadoEm: agora, atualizadoEm: agora },
  });
  return paraFuncionario(registro);
}

export async function atualizarFuncionario(id: string, input: Partial<NovoFuncionarioInput>): Promise<Funcionario> {
  const sessao = await exigirGestaoEscritaAction();
  const parsed = atualizarFuncionarioSchema.safeParse(input);
  if (!parsed.success) throw new Error("Dados inválidos.");
  await validarObraDaEmpresa(parsed.data.obraId, sessao.empresaId);

  const resultado = await prisma.funcionario.updateMany({
    where: { id, empresaId: sessao.empresaId },
    data: { ...parsed.data, atualizadoEm: new Date().toISOString() },
  });
  if (resultado.count === 0) throw new Error("Funcionário não encontrado.");

  const registro = await prisma.funcionario.findFirstOrThrow({ where: { id, empresaId: sessao.empresaId } });
  return paraFuncionario(registro);
}

export async function definirStatusFuncionario(id: string, status: StatusFuncionario): Promise<Funcionario> {
  const sessao = await exigirGestaoEscritaAction();
  const parsed = statusFuncionarioSchema.safeParse(status);
  if (!parsed.success) throw new Error("Status inválido.");

  const resultado = await prisma.funcionario.updateMany({
    where: { id, empresaId: sessao.empresaId },
    data: { status: parsed.data, atualizadoEm: new Date().toISOString() },
  });
  if (resultado.count === 0) throw new Error("Funcionário não encontrado.");

  const registro = await prisma.funcionario.findFirstOrThrow({ where: { id, empresaId: sessao.empresaId } });
  return paraFuncionario(registro);
}
