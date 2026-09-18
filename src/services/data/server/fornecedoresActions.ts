"use server";

import { prisma } from "@/lib/prisma";
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

function paraDados(input: Partial<NovoFornecedorInput>) {
  return { ...input, documento: normalizarDocumento(input.documento) };
}

export async function listarFornecedores(filtros?: FiltrosFornecedor): Promise<Fornecedor[]> {
  const registros = await prisma.fornecedor.findMany({
    where: filtros?.busca
      ? {
          OR: [
            { nome: { contains: filtros.busca, mode: "insensitive" } },
            { documento: { contains: normalizarDocumento(filtros.busca) ?? filtros.busca, mode: "insensitive" } },
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
    data: { ...paraDados(input), nome: input.nome, criadoEm: agora, atualizadoEm: agora },
  });
  return paraFornecedor(registro);
}

export async function atualizarFornecedor(id: string, input: Partial<NovoFornecedorInput>): Promise<Fornecedor> {
  const registro = await prisma.fornecedor.update({
    where: { id },
    data: { ...paraDados(input), atualizadoEm: new Date().toISOString() },
  });
  return paraFornecedor(registro);
}

/**
 * Usado na captura por câmera: acha o fornecedor já cadastrado pelo CNPJ/CPF
 * lido pela IA (chave confiável) ou, na falta dele, pelo nome; se nenhum bater,
 * cadastra automaticamente com o que foi possível ler — sem exigir que o
 * usuário confirme a criação manualmente.
 */
export async function resolverFornecedor(nome: string, documento?: string): Promise<Fornecedor> {
  const documentoNormalizado = normalizarDocumento(documento);

  if (documentoNormalizado) {
    const porDocumento = await prisma.fornecedor.findFirst({ where: { documento: documentoNormalizado } });
    if (porDocumento) return paraFornecedor(porDocumento);
  }

  const nomeTratado = nome.trim();
  if (nomeTratado) {
    const porNome = await prisma.fornecedor.findFirst({
      where: { nome: { equals: nomeTratado, mode: "insensitive" } },
    });
    if (porNome) return paraFornecedor(porNome);
  }

  return criarFornecedor({ nome: nomeTratado || "Fornecedor não identificado", documento: documentoNormalizado });
}
