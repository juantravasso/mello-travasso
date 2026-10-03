"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { exigirAdminAction } from "@/lib/auth/dal";
import {
  atualizarCategoriaSchema,
  atualizarProfissaoSchema,
  novaCategoriaSchema,
  novaProfissaoSchema,
} from "@/lib/validacao/rede";
import { gerarSlug } from "@/lib/rede/texto";
import type {
  AtualizarCategoriaInput,
  AtualizarProfissaoInput,
  CategoriaItem,
  NovaCategoriaInput,
  NovaProfissaoInput,
} from "@/types";
import type { ResultadoAction } from "@/types";
import { registrarLogAdmin } from "./adminLog.server";
import { listarTaxonomia } from "./redeCore.server";
import { ErroDeNegocio, executar } from "./resultado.server";

function ehViolacaoDeChave(erro: unknown): boolean {
  return erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2003";
}

const MENSAGEM_DUPLICADO = "Já existe um item com esse nome.";

function ehConflito(erro: unknown): boolean {
  return erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002";
}

async function slugLivre(base: string, existe: (slug: string) => Promise<boolean>): Promise<string> {
  if (!(await existe(base))) return base;
  for (let n = 2; n < 50; n++) {
    const candidato = `${base}-${n}`;
    if (!(await existe(candidato))) return candidato;
  }
  throw new ErroDeNegocio(MENSAGEM_DUPLICADO);
}

/** Taxonomia ativa — dado público (alimenta filtros da busca e o editor de perfil). */
export async function listarTaxonomiaAtiva(): Promise<CategoriaItem[]> {
  return listarTaxonomia(false);
}

export async function listarTaxonomiaAdmin(): Promise<CategoriaItem[]> {
  await exigirAdminAction();
  return listarTaxonomia(true);
}

/** Subcategorias vão até 2 níveis: o pai precisa existir e não ser, ele mesmo, subcategoria. */
async function validarPai(paiId: string, proprioId?: string): Promise<void> {
  if (paiId === proprioId) throw new ErroDeNegocio("Uma categoria não pode ser pai dela mesma.");
  const pai = await prisma.categoria.findUnique({ where: { id: paiId }, select: { paiId: true } });
  if (!pai) throw new ErroDeNegocio("Categoria pai não encontrada.");
  if (pai.paiId) throw new ErroDeNegocio("Subcategorias só podem ter um nível.");
}

async function criarCategoriaInterno(input: NovaCategoriaInput): Promise<void> {
  const admin = await exigirAdminAction();
  const parsed = novaCategoriaSchema.safeParse(input);
  if (!parsed.success) throw new ErroDeNegocio(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  if (parsed.data.paiId) await validarPai(parsed.data.paiId);

  const slug = await slugLivre(
    gerarSlug(parsed.data.nome),
    async (s) => !!(await prisma.categoria.findUnique({ where: { slug: s } })),
  );
  const agora = new Date().toISOString();
  try {
    await prisma.$transaction(async (tx) => {
      const criada = await tx.categoria.create({
        data: { nome: parsed.data.nome, slug, paiId: parsed.data.paiId, criadoEm: agora, atualizadoEm: agora },
      });
      await registrarLogAdmin(tx, admin.usuarioId, "categoria.criar", "Categoria", criada.id, {
        nome: criada.nome,
        paiId: criada.paiId,
      });
    });
  } catch (erro) {
    if (ehConflito(erro)) throw new ErroDeNegocio(MENSAGEM_DUPLICADO);
    throw erro;
  }
}

async function atualizarCategoriaInterno(id: string, input: AtualizarCategoriaInput): Promise<void> {
  const admin = await exigirAdminAction();
  const parsed = atualizarCategoriaSchema.safeParse(input);
  if (!parsed.success) throw new ErroDeNegocio(parsed.error.issues[0]?.message ?? "Dados inválidos.");

  const atual = await prisma.categoria.findUnique({ where: { id }, include: { _count: { select: { filhas: true } } } });
  if (!atual) throw new ErroDeNegocio("Categoria não encontrada.");

  const { paiId, ...resto } = parsed.data;
  if (paiId !== undefined && paiId !== null) {
    await validarPai(paiId, id);
    if (atual._count.filhas > 0) throw new ErroDeNegocio("Esta categoria tem subcategorias e não pode virar subcategoria.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.categoria.update({
      where: { id },
      data: { ...resto, ...(paiId !== undefined ? { paiId } : {}), atualizadoEm: new Date().toISOString() },
    });
    await registrarLogAdmin(tx, admin.usuarioId, "categoria.atualizar", "Categoria", id, {
      antes: { nome: atual.nome, paiId: atual.paiId, ordem: atual.ordem, ativo: atual.ativo },
      depois: parsed.data,
    });
  });
}

async function excluirCategoriaInterno(id: string): Promise<void> {
  const admin = await exigirAdminAction();
  const categoria = await prisma.categoria.findUnique({
    where: { id },
    include: { _count: { select: { filhas: true, profissoes: true } } },
  });
  if (!categoria) throw new ErroDeNegocio("Categoria não encontrada.");
  if (categoria._count.filhas > 0 || categoria._count.profissoes > 0) {
    throw new ErroDeNegocio("Só dá para excluir categorias vazias. Desative esta ou remova antes as profissões e subcategorias.");
  }
  try {
    await prisma.$transaction(async (tx) => {
      await tx.categoria.delete({ where: { id } });
      await registrarLogAdmin(tx, admin.usuarioId, "categoria.excluir", "Categoria", id, { nome: categoria.nome });
    });
  } catch (erro) {
    // Alguém vinculou uma profissão ou subcategoria entre a conferência e o delete.
    if (ehViolacaoDeChave(erro)) throw new ErroDeNegocio("Esta categoria passou a ter itens. Atualize a página e tente de novo.");
    throw erro;
  }
}

async function criarProfissaoInterno(input: NovaProfissaoInput): Promise<void> {
  const admin = await exigirAdminAction();
  const parsed = novaProfissaoSchema.safeParse(input);
  if (!parsed.success) throw new ErroDeNegocio(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const categoria = await prisma.categoria.findUnique({ where: { id: parsed.data.categoriaId }, select: { id: true } });
  if (!categoria) throw new ErroDeNegocio("Categoria não encontrada.");

  const slug = await slugLivre(
    gerarSlug(parsed.data.nome),
    async (s) => !!(await prisma.profissao.findUnique({ where: { slug: s } })),
  );
  const agora = new Date().toISOString();
  try {
    await prisma.$transaction(async (tx) => {
      const criada = await tx.profissao.create({
        data: { nome: parsed.data.nome, slug, categoriaId: parsed.data.categoriaId, criadoEm: agora, atualizadoEm: agora },
      });
      await registrarLogAdmin(tx, admin.usuarioId, "profissao.criar", "Profissao", criada.id, {
        nome: criada.nome,
        categoriaId: criada.categoriaId,
      });
    });
  } catch (erro) {
    if (ehConflito(erro)) throw new ErroDeNegocio(MENSAGEM_DUPLICADO);
    throw erro;
  }
}

async function atualizarProfissaoInterno(id: string, input: AtualizarProfissaoInput): Promise<void> {
  const admin = await exigirAdminAction();
  const parsed = atualizarProfissaoSchema.safeParse(input);
  if (!parsed.success) throw new ErroDeNegocio(parsed.error.issues[0]?.message ?? "Dados inválidos.");

  const atual = await prisma.profissao.findUnique({ where: { id } });
  if (!atual) throw new ErroDeNegocio("Profissão não encontrada.");
  if (parsed.data.categoriaId) {
    const categoria = await prisma.categoria.findUnique({ where: { id: parsed.data.categoriaId }, select: { id: true } });
    if (!categoria) throw new ErroDeNegocio("Categoria não encontrada.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.profissao.update({ where: { id }, data: { ...parsed.data, atualizadoEm: new Date().toISOString() } });
    await registrarLogAdmin(tx, admin.usuarioId, "profissao.atualizar", "Profissao", id, {
      antes: { nome: atual.nome, categoriaId: atual.categoriaId, ativo: atual.ativo },
      depois: parsed.data,
    });
  });
}

async function excluirProfissaoInterno(id: string): Promise<void> {
  const admin = await exigirAdminAction();
  const profissao = await prisma.profissao.findUnique({
    where: { id },
    include: { _count: { select: { perfis: true } } },
  });
  if (!profissao) throw new ErroDeNegocio("Profissão não encontrada.");
  if (profissao._count.perfis > 0) {
    throw new ErroDeNegocio("Há perfis usando esta profissão. Desative-a em vez de excluir.");
  }
  try {
    await prisma.$transaction(async (tx) => {
      await tx.profissao.delete({ where: { id } });
      await registrarLogAdmin(tx, admin.usuarioId, "profissao.excluir", "Profissao", id, { nome: profissao.nome });
    });
  } catch (erro) {
    if (ehViolacaoDeChave(erro)) throw new ErroDeNegocio("Há perfis usando esta profissão. Desative-a em vez de excluir.");
    throw erro;
  }
}

export async function criarCategoria(input: NovaCategoriaInput): Promise<ResultadoAction<null>> {
  return executar(async () => {
    await criarCategoriaInterno(input);
    return null;
  });
}

export async function atualizarCategoria(id: string, input: AtualizarCategoriaInput): Promise<ResultadoAction<null>> {
  return executar(async () => {
    await atualizarCategoriaInterno(id, input);
    return null;
  });
}

export async function excluirCategoria(id: string): Promise<ResultadoAction<null>> {
  return executar(async () => {
    await excluirCategoriaInterno(id);
    return null;
  });
}

export async function criarProfissao(input: NovaProfissaoInput): Promise<ResultadoAction<null>> {
  return executar(async () => {
    await criarProfissaoInterno(input);
    return null;
  });
}

export async function atualizarProfissao(id: string, input: AtualizarProfissaoInput): Promise<ResultadoAction<null>> {
  return executar(async () => {
    await atualizarProfissaoInterno(id, input);
    return null;
  });
}

export async function excluirProfissao(id: string): Promise<ResultadoAction<null>> {
  return executar(async () => {
    await excluirProfissaoInterno(id);
    return null;
  });
}
