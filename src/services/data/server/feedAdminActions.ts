"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { exigirAdminAction } from "@/lib/auth/dal";
import { normalizarBusca } from "@/lib/rede/texto";
import type { ResultadoAction } from "@/types";
import { registrarLogAdmin } from "./adminLog.server";
import { exigirSenhaDoAdmin } from "./reautenticacao.server";
import { ErroDeNegocio, executar } from "./resultado.server";

// Moderação do feed pela administração: fila de denúncias de postagens e comentários e a lista das postagens recentes.
// Tudo exige administrador; decidir pede a senha de novo e um motivo, e entra no registro de ações. Ocultar não apaga
// nada (dá para restaurar) e a foto deixa de ser servida enquanto a postagem não estiver publicada.

export interface DenunciaPostagemAdmin {
  id: string;
  alvo: "postagem" | "comentario";
  motivo: string;
  descricao: string;
  criadoEm: string;
  denunciante: string;
  /** Texto do conteúdo denunciado, como está no ar. */
  texto: string;
  autorNome: string;
  autorSlug: string;
  fotos: string[];
  postagemId: string;
  comentarioId: string | null;
}

export interface PostagemAdmin {
  id: string;
  texto: string;
  status: "publicada" | "oculta" | "apagada";
  criadoEm: string;
  autorNome: string;
  autorSlug: string;
  fotos: string[];
  denunciasAbertas: number;
}

const decisaoSchema = z
  .object({
    id: z.string().uuid(),
    decisao: z.enum(["ocultar", "manter"]),
    motivo: z.string().trim().min(5, "Explique o motivo (mínimo 5 letras).").max(500),
  })
  .strict();

const statusSchema = z
  .object({
    id: z.string().uuid(),
    status: z.enum(["publicada", "oculta"]),
    motivo: z.string().trim().min(5, "Explique o motivo (mínimo 5 letras).").max(500),
  })
  .strict();

export async function listarDenunciasPostagem(): Promise<DenunciaPostagemAdmin[]> {
  await exigirAdminAction();
  const linhas = await prisma.denunciaPostagem.findMany({
    where: { resolvidaEm: null },
    orderBy: [{ criadoEm: "asc" }, { id: "asc" }],
    take: 50,
    select: {
      id: true,
      motivo: true,
      descricao: true,
      criadoEm: true,
      postagemId: true,
      comentarioId: true,
      denunciante: { select: { razaoSocial: true } },
      comentario: { select: { texto: true, perfil: { select: { nome: true, slug: true } } } },
      postagem: {
        select: {
          texto: true,
          perfil: { select: { nome: true, slug: true } },
          fotos: { orderBy: { ordem: "asc" }, select: { arquivoId: true } },
        },
      },
    },
  });
  return linhas.map((l) => ({
    id: l.id,
    alvo: l.comentarioId ? "comentario" : "postagem",
    motivo: l.motivo,
    descricao: l.descricao,
    criadoEm: l.criadoEm,
    denunciante: l.denunciante.razaoSocial,
    texto: l.comentario?.texto ?? l.postagem.texto,
    autorNome: l.comentario?.perfil.nome ?? l.postagem.perfil.nome,
    autorSlug: l.comentario?.perfil.slug ?? l.postagem.perfil.slug,
    fotos: l.comentarioId ? [] : l.postagem.fotos.map((f) => `/api/arquivos/${f.arquivoId}`),
    postagemId: l.postagemId,
    comentarioId: l.comentarioId,
  }));
}

/** Decide uma denúncia: oculta o conteúdo (reversível) ou mantém. Resolve todas as denúncias abertas do mesmo alvo. */
export async function decidirDenunciaPostagem(input: unknown, senha?: string): Promise<ResultadoAction<null>> {
  const admin = await exigirAdminAction();
  return executar(async () => {
    const parsed = decisaoSchema.safeParse(input);
    if (!parsed.success) throw new ErroDeNegocio(parsed.error.issues[0]?.message ?? "Dados inválidos.");
    await exigirSenhaDoAdmin(admin.usuarioId, senha);
    const agora = new Date().toISOString();
    await prisma.$transaction(async (tx) => {
      const d = await tx.denunciaPostagem.findUnique({ where: { id: parsed.data.id }, select: { id: true, alvoChave: true, postagemId: true, comentarioId: true, resolvidaEm: true } });
      if (!d) throw new ErroDeNegocio("Denúncia não encontrada.");
      if (d.resolvidaEm) throw new ErroDeNegocio("Esta denúncia já foi decidida.");
      if (parsed.data.decisao === "ocultar") {
        if (d.comentarioId) await tx.comentarioPostagem.updateMany({ where: { id: d.comentarioId, status: "publicada" }, data: { status: "oculta" } });
        else await tx.postagem.updateMany({ where: { id: d.postagemId, status: "publicada" }, data: { status: "oculta", motivoOcultacao: parsed.data.motivo, atualizadoEm: agora } });
      }
      await tx.denunciaPostagem.updateMany({
        where: { alvoChave: d.alvoChave, resolvidaEm: null },
        data: { resolvidaEm: agora, decisao: parsed.data.decisao === "ocultar" ? "ocultada" : "mantida", adminResponsavelId: admin.usuarioId },
      });
      await registrarLogAdmin(tx, admin.usuarioId, `feed.denuncia_${parsed.data.decisao}`, d.comentarioId ? "ComentarioPostagem" : "Postagem", d.comentarioId ?? d.postagemId, { denunciaId: d.id, motivo: parsed.data.motivo });
    });
    return null;
  });
}

export async function listarPostagensAdmin(busca?: string): Promise<PostagemAdmin[]> {
  await exigirAdminAction();
  const termo = typeof busca === "string" ? normalizarBusca(busca).replace(/[%_\\]/g, " ").trim().slice(0, 80) : "";
  const linhas = await prisma.postagem.findMany({
    where: {
      status: { in: ["publicada", "oculta"] },
      ...(termo ? { OR: [{ perfil: { nomeBusca: { contains: termo } } }, { texto: { contains: termo, mode: "insensitive" } }] } : {}),
    },
    orderBy: [{ criadoEm: "desc" }, { id: "desc" }],
    take: 50,
    select: {
      id: true,
      texto: true,
      status: true,
      criadoEm: true,
      perfil: { select: { nome: true, slug: true } },
      fotos: { orderBy: { ordem: "asc" }, select: { arquivoId: true } },
      _count: { select: { denuncias: { where: { resolvidaEm: null } } } },
    },
  });
  return linhas.map((l) => ({
    id: l.id,
    texto: l.texto,
    status: l.status,
    criadoEm: l.criadoEm,
    autorNome: l.perfil.nome,
    autorSlug: l.perfil.slug,
    fotos: l.fotos.map((f) => `/api/arquivos/${f.arquivoId}`),
    denunciasAbertas: l._count.denuncias,
  }));
}

/** Oculta uma postagem sem denúncia (ou restaura uma oculta). */
export async function alterarStatusPostagemAdmin(input: unknown, senha?: string): Promise<ResultadoAction<null>> {
  const admin = await exigirAdminAction();
  return executar(async () => {
    const parsed = statusSchema.safeParse(input);
    if (!parsed.success) throw new ErroDeNegocio(parsed.error.issues[0]?.message ?? "Dados inválidos.");
    await exigirSenhaDoAdmin(admin.usuarioId, senha);
    await prisma.$transaction(async (tx) => {
      const de = parsed.data.status === "oculta" ? "publicada" : "oculta";
      const r = await tx.postagem.updateMany({
        where: { id: parsed.data.id, status: de },
        data: { status: parsed.data.status, motivoOcultacao: parsed.data.status === "oculta" ? parsed.data.motivo : null, atualizadoEm: new Date().toISOString() },
      });
      if (r.count === 0) throw new ErroDeNegocio("Postagem não encontrada ou já está nesse estado.");
      await registrarLogAdmin(tx, admin.usuarioId, parsed.data.status === "oculta" ? "feed.postagem_ocultar" : "feed.postagem_restaurar", "Postagem", parsed.data.id, { motivo: parsed.data.motivo });
    });
    return null;
  });
}
