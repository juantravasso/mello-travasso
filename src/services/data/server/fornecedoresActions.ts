"use server";

import { prisma } from "@/lib/prisma";
import { exigirGestaoEscritaAction, exigirGestaoAction } from "@/lib/auth/dal";
import { ACESSO } from "@/lib/auth/modulos";
import { novoFornecedorSchema, atualizarFornecedorSchema } from "@/lib/validacao/fornecedores";
import type { FiltrosFornecedor, Fornecedor, NovoFornecedorInput } from "@/types";
import { normalizarDocumento } from "@/lib/documento";

type FornecedorRegistro = {
  id: string;
  nome: string;
  documento: string | null;
  telefone: string | null;
  email: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  observacao: string | null;
  criadoEm: string;
  atualizadoEm: string;
};

function paraFornecedor(registro: FornecedorRegistro): Fornecedor {
  return {
    id: registro.id,
    nome: registro.nome,
    documento: registro.documento ?? undefined,
    telefone: registro.telefone ?? undefined,
    email: registro.email ?? undefined,
    cep: registro.cep ?? undefined,
    logradouro: registro.logradouro ?? undefined,
    numero: registro.numero ?? undefined,
    complemento: registro.complemento ?? undefined,
    bairro: registro.bairro ?? undefined,
    cidade: registro.cidade ?? undefined,
    estado: registro.estado ?? undefined,
    observacao: registro.observacao ?? undefined,
    criadoEm: registro.criadoEm,
    atualizadoEm: registro.atualizadoEm,
  };
}

function paraDados<T extends { documento?: string }>(input: T) {
  return { ...input, documento: normalizarDocumento(input.documento) };
}

export async function listarFornecedores(filtros?: FiltrosFornecedor): Promise<Fornecedor[]> {
  const sessao = await exigirGestaoAction(...ACESSO.fornecedoresLer);
  const registros = await prisma.fornecedor.findMany({
    where: {
      empresaId: sessao.empresaId,
      ...(filtros?.busca
        ? {
            OR: [
              { nome: { contains: filtros.busca, mode: "insensitive" } },
              { documento: { contains: normalizarDocumento(filtros.busca) ?? filtros.busca, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { nome: "asc" },
  });
  return registros.map(paraFornecedor);
}

export async function obterFornecedorPorId(id: string): Promise<Fornecedor | null> {
  const sessao = await exigirGestaoAction(...ACESSO.fornecedoresLer);
  const registro = await prisma.fornecedor.findFirst({ where: { id, empresaId: sessao.empresaId } });
  return registro ? paraFornecedor(registro) : null;
}

export async function criarFornecedor(input: NovoFornecedorInput): Promise<Fornecedor> {
  const sessao = await exigirGestaoEscritaAction(...ACESSO.fornecedoresCriar);
  const parsed = novoFornecedorSchema.safeParse(input);
  if (!parsed.success) throw new Error("Dados inválidos.");

  const agora = new Date().toISOString();
  const registro = await prisma.fornecedor.create({
    data: { ...paraDados(parsed.data), empresaId: sessao.empresaId, criadoEm: agora, atualizadoEm: agora },
  });
  return paraFornecedor(registro);
}

export async function atualizarFornecedor(id: string, input: Partial<NovoFornecedorInput>): Promise<Fornecedor> {
  const sessao = await exigirGestaoEscritaAction(...ACESSO.fornecedoresAlterar);
  const parsed = atualizarFornecedorSchema.safeParse(input);
  if (!parsed.success) throw new Error("Dados inválidos.");

  const resultado = await prisma.fornecedor.updateMany({
    where: { id, empresaId: sessao.empresaId },
    data: { ...paraDados(parsed.data), atualizadoEm: new Date().toISOString() },
  });
  if (resultado.count === 0) throw new Error("Fornecedor não encontrado.");

  const registro = await prisma.fornecedor.findFirstOrThrow({ where: { id, empresaId: sessao.empresaId } });
  return paraFornecedor(registro);
}

/**
 * Usado na captura por câmera: acha o fornecedor já cadastrado pelo CNPJ/CPF
 * lido pela IA (chave confiável) ou, na falta dele, pelo nome; se nenhum bater,
 * cadastra automaticamente com o que foi possível ler — sem exigir que o
 * usuário confirme a criação manualmente. Escopado à empresa da sessão, tanto
 * na busca quanto no cadastro (feito via criarFornecedor).
 */
export async function resolverFornecedor(nome: string, documento?: string): Promise<Fornecedor> {
  const sessao = await exigirGestaoEscritaAction(...ACESSO.fornecedoresCriar);
  const documentoNormalizado = normalizarDocumento(documento);

  if (documentoNormalizado) {
    const porDocumento = await prisma.fornecedor.findFirst({
      where: { documento: documentoNormalizado, empresaId: sessao.empresaId },
    });
    if (porDocumento) return paraFornecedor(porDocumento);
  }

  const nomeTratado = nome.trim();
  if (nomeTratado) {
    const porNome = await prisma.fornecedor.findFirst({
      where: { nome: { equals: nomeTratado, mode: "insensitive" }, empresaId: sessao.empresaId },
    });
    if (porNome) return paraFornecedor(porNome);
  }

  return criarFornecedor({ nome: nomeTratado || "Fornecedor não identificado", documento: documentoNormalizado });
}
