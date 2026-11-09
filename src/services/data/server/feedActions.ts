"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { exigirSessaoAction, obterSessaoOpcional } from "@/lib/auth/dal";
import { verificarLimite } from "@/lib/auth/limite";
import { COMENTARIOS_POR_DIA, CURTIDAS_POR_DIA } from "@/lib/feed";
import { comentarioSchema, denunciarPostagemSchema, idSchema, paginaSchema } from "@/lib/validacao/feed";
import type { ComentarioItem, PaginaFeed, ResultadoAction } from "@/types";
import { IDADE_MINIMA_CONTA_MS } from "./avaliacaoCore.server";
import { exigirParticipante, listarComentarios, listarFeed } from "./feedCore.server";
import { ErroDeNegocio, executar } from "./resultado.server";

const UM_DIA_MS = 24 * 60 * 60 * 1000;
const DENUNCIAS_POR_DIA = 10;

function ehConflito(erro: unknown): boolean {
  return erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002";
}

function invalido(): never {
  throw new ErroDeNegocio("Dados inválidos.");
}

/** Leitura pública (visitante também): próxima página do feed. */
export async function carregarFeed(input: unknown): Promise<ResultadoAction<PaginaFeed>> {
  const parsed = paginaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, erro: "VALIDACAO", mensagem: "Dados inválidos." };
  const sessao = await obterSessaoOpcional();
  return executar(() => listarFeed(sessao, parsed.data.cursor));
}

export async function carregarComentarios(input: unknown): Promise<ResultadoAction<ComentarioItem[]>> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false, erro: "VALIDACAO", mensagem: "Dados inválidos." };
  const sessao = await obterSessaoOpcional();
  return executar(() => listarComentarios(sessao, parsed.data.id));
}

/** Curtir ou tirar a curtida. Devolve o estado novo e o total. */
export async function alternarCurtida(input: unknown): Promise<ResultadoAction<{ curtiu: boolean; total: number }>> {
  const sessao = await exigirSessaoAction();
  return executar(async () => {
    const parsed = idSchema.safeParse(input);
    if (!parsed.success) invalido();
    await exigirParticipante(sessao);
    const limite = await verificarLimite(`feed-curtir:${sessao.empresaId}`, CURTIDAS_POR_DIA, UM_DIA_MS);
    if (!limite.permitido) throw new ErroDeNegocio("Muitas curtidas hoje. Tente de novo amanhã.");

    const postagemId = parsed.data.id;
    const post = await prisma.postagem.findFirst({
      where: { id: postagemId, status: "publicada", perfil: { status: "publicado" } },
      select: { id: true },
    });
    if (!post) throw new ErroDeNegocio("Postagem não encontrada.");

    const chave = { postagemId_empresaId: { postagemId, empresaId: sessao.empresaId } };
    const existente = await prisma.postagemCurtida.findUnique({ where: chave, select: { postagemId: true } });
    if (existente) {
      await prisma.postagemCurtida.deleteMany({ where: { postagemId, empresaId: sessao.empresaId } });
    } else {
      try {
        await prisma.postagemCurtida.create({ data: { postagemId, empresaId: sessao.empresaId, criadoEm: new Date().toISOString() } });
      } catch (erro) {
        if (!ehConflito(erro)) throw erro;
      }
    }
    const total = await prisma.postagemCurtida.count({ where: { postagemId } });
    return { curtiu: !existente, total };
  });
}

export async function comentar(input: unknown): Promise<ResultadoAction<{ comentarios: ComentarioItem[] }>> {
  const sessao = await exigirSessaoAction();
  return executar(async () => {
    const parsed = comentarioSchema.safeParse(input);
    if (!parsed.success) throw new ErroDeNegocio(parsed.error.issues[0]?.message ?? "Dados inválidos.");
    const { perfilId } = await exigirParticipante(sessao);
    const limite = await verificarLimite(`feed-comentar:${sessao.empresaId}`, COMENTARIOS_POR_DIA, UM_DIA_MS);
    if (!limite.permitido) throw new ErroDeNegocio("Muitos comentários hoje. Tente de novo amanhã.");

    const post = await prisma.postagem.findFirst({
      where: { id: parsed.data.postagemId, status: "publicada", perfil: { status: "publicado" }, empresa: { bloqueadaEm: null } },
      select: { id: true },
    });
    if (!post) throw new ErroDeNegocio("Postagem não encontrada.");
    await prisma.comentarioPostagem.create({
      data: {
        postagemId: post.id,
        perfilId,
        empresaId: sessao.empresaId,
        usuarioId: sessao.usuarioId,
        texto: parsed.data.texto,
        criadoEm: new Date().toISOString(),
      },
    });
    return { comentarios: await listarComentarios(sessao, post.id) };
  });
}

/** O autor apaga a própria postagem (qualquer usuário da empresa dona). As fotos saem do banco junto. */
export async function apagarPostagem(input: unknown): Promise<ResultadoAction<null>> {
  const sessao = await exigirSessaoAction();
  return executar(async () => {
    const parsed = idSchema.safeParse(input);
    if (!parsed.success) invalido();
    const r = await prisma.postagem.updateMany({
      where: { id: parsed.data.id, empresaId: sessao.empresaId, status: { not: "apagada" } },
      data: { status: "apagada", atualizadoEm: new Date().toISOString() },
    });
    if (r.count === 0) throw new ErroDeNegocio("Postagem não encontrada.");
    await prisma.arquivo.deleteMany({ where: { empresaId: sessao.empresaId, fotoPostagem: { postagemId: parsed.data.id } } });
    return null;
  });
}

export async function apagarComentario(input: unknown): Promise<ResultadoAction<null>> {
  const sessao = await exigirSessaoAction();
  return executar(async () => {
    const parsed = idSchema.safeParse(input);
    if (!parsed.success) invalido();
    const r = await prisma.comentarioPostagem.updateMany({
      where: { id: parsed.data.id, empresaId: sessao.empresaId, status: { not: "apagada" } },
      data: { status: "apagada" },
    });
    if (r.count === 0) throw new ErroDeNegocio("Comentário não encontrado.");
    return null;
  });
}

/** Denuncia uma postagem ou um comentário. Só entra numa fila; quem decide é a administração. */
export async function denunciarPostagem(input: unknown): Promise<ResultadoAction<null>> {
  const sessao = await exigirSessaoAction();
  return executar(async () => {
    const parsed = denunciarPostagemSchema.safeParse(input);
    if (!parsed.success) throw new ErroDeNegocio(parsed.error.issues[0]?.message ?? "Dados inválidos.");
    await exigirParticipante(sessao);
    const { postagemId, comentarioId, motivo, descricao } = parsed.data;

    const conta = await prisma.empresa.findUniqueOrThrow({ where: { id: sessao.empresaId }, select: { criadoEm: true } });
    if (Date.now() - new Date(conta.criadoEm).getTime() < IDADE_MINIMA_CONTA_MS) {
      throw new ErroDeNegocio("Sua conta precisa ter pelo menos 24 horas para enviar denúncias. Volte amanhã.");
    }
    const limite = await verificarLimite(`feed-denunciar:${sessao.empresaId}`, DENUNCIAS_POR_DIA, UM_DIA_MS);
    if (!limite.permitido) throw new ErroDeNegocio("Você já enviou muitas denúncias hoje. Tente de novo amanhã.");

    let empresaDoAlvo: string | null = null;
    if (comentarioId) {
      const c = await prisma.comentarioPostagem.findFirst({ where: { id: comentarioId, postagemId, status: "publicada" }, select: { empresaId: true } });
      empresaDoAlvo = c?.empresaId ?? null;
    } else {
      const p = await prisma.postagem.findFirst({ where: { id: postagemId, status: "publicada" }, select: { empresaId: true } });
      empresaDoAlvo = p?.empresaId ?? null;
    }
    if (!empresaDoAlvo) throw new ErroDeNegocio("Conteúdo não encontrado.");
    if (empresaDoAlvo === sessao.empresaId) throw new ErroDeNegocio("Este conteúdo é seu. Para tirá-lo do ar, apague-o.");

    try {
      await prisma.denunciaPostagem.create({
        data: {
          postagemId,
          comentarioId,
          alvoChave: comentarioId ? `c:${comentarioId}` : `p:${postagemId}`,
          denuncianteEmpresaId: sessao.empresaId,
          denuncianteUsuarioId: sessao.usuarioId,
          motivo,
          descricao,
          criadoEm: new Date().toISOString(),
        },
      });
    } catch (erro) {
      if (ehConflito(erro)) throw new ErroDeNegocio("Você já denunciou este conteúdo. Vamos analisar.");
      throw erro;
    }
    return null;
  });
}
