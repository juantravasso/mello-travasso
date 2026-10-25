"use server";

import { prisma } from "@/lib/prisma";
import { exigirGestaoEscritaAction, exigirGestaoAction } from "@/lib/auth/dal";
import { ACESSO } from "@/lib/auth/modulos";
import { novoFuncionarioSchema, atualizarFuncionarioSchema, statusFuncionarioSchema } from "@/lib/validacao/funcionarios";
import type { AcessoTemporario, FiltrosFuncionario, Funcionario, NovoFuncionarioInput, ResultadoAction, StatusFuncionario } from "@/types";
import type { ModuloChave } from "@/lib/auth/modulos";
import { ErroDeNegocio, executar } from "./resultado.server";
import * as usuarios from "./usuariosEmpresaCore.server";

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
  const sessao = await exigirGestaoAction(...ACESSO.funcionariosLer);
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
  const sessao = await exigirGestaoAction(...ACESSO.funcionariosLer);
  const registro = await prisma.funcionario.findFirst({ where: { id, empresaId: sessao.empresaId } });
  return registro ? paraFuncionario(registro) : null;
}

async function validarObraDaEmpresa(obraId: string | undefined, empresaId: string): Promise<void> {
  if (!obraId) return;
  const obra = await prisma.obra.findFirst({ where: { id: obraId, empresaId } });
  if (!obra) throw new Error("Projeto não encontrado.");
}

export async function criarFuncionario(input: NovoFuncionarioInput): Promise<Funcionario> {
  const sessao = await exigirGestaoEscritaAction(...ACESSO.funcionariosEscrever);
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
  const sessao = await exigirGestaoEscritaAction(...ACESSO.funcionariosEscrever);
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
  const sessao = await exigirGestaoEscritaAction(...ACESSO.funcionariosEscrever);
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

/**
 * Cadastra o funcionário e, junto, o acesso dele ao sistema: login pelo e-mail dele, senha inicial "mudar1234" (a pessoa é
 * obrigada a trocar no primeiro acesso, e ela deixa de valer sozinha em poucos dias) e os módulos escolhidos. Só o dono
 * cria acesso, confirmando a própria senha. Se a ficha não puder ser gravada, o acesso recém-criado é desfeito.
 */
export async function criarFuncionarioComAcesso(
  input: NovoFuncionarioInput,
  acesso: { modulos: ModuloChave[]; senhaDoDono: string },
): Promise<ResultadoAction<{ funcionario: Funcionario; acesso: AcessoTemporario }>> {
  return executar(async () => {
    const sessao = await exigirGestaoEscritaAction(...ACESSO.funcionariosEscrever);
    if (sessao.papel !== "dono") throw new ErroDeNegocio("Só o dono da empresa dá acesso ao sistema.");
    const parsed = novoFuncionarioSchema.safeParse(input);
    if (!parsed.success) throw new ErroDeNegocio(parsed.error.issues[0]?.message ?? "Dados inválidos.");
    if (!parsed.data.email) throw new ErroDeNegocio("Informe o e-mail do funcionário: é com ele que a pessoa vai entrar.");
    if (parsed.data.obraId) {
      const obra = await prisma.obra.findFirst({ where: { id: parsed.data.obraId, empresaId: sessao.empresaId } });
      if (!obra) throw new ErroDeNegocio("Projeto não encontrado.");
    }

    const ctx = { usuarioId: sessao.usuarioId, empresaId: sessao.empresaId };
    const criado = await usuarios.criar(ctx, { nome: parsed.data.nome, email: parsed.data.email, modulos: acesso.modulos }, acesso.senhaDoDono);
    const agora = new Date().toISOString();
    try {
      const registro = await prisma.funcionario.create({
        data: { ...parsed.data, empresaId: sessao.empresaId, status: "ativo", usuarioId: criado.usuarioId, criadoEm: agora, atualizadoEm: agora },
      });
      return { funcionario: paraFuncionario(registro), acesso: criado };
    } catch (erro) {
      if (criado.usuarioId) await usuarios.desfazerCriacao(ctx, criado.usuarioId);
      throw erro;
    }
  });
}
