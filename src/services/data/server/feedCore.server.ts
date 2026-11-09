import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { obterRecursosDaEmpresa } from "@/lib/auth/dal";
import { temAlgumModulo } from "@/lib/auth/modulos";
import type { SessaoValida } from "@/lib/auth/sessao";
import { COMENTARIOS_POR_PAGINA, TAMANHO_PAGINA_FEED } from "@/lib/feed";
import { codificarCursor, decodificarCursor } from "@/lib/feedCursor";
import type { AutorPostagem, ComentarioItem, PaginaFeed, PostagemItem, SituacaoFeed } from "@/types";
import { ErroDeNegocio } from "./resultado.server";

// Leitura do feed (pública) e a regra de quem pode publicar/interagir. O feed só mostra postagens publicadas de perfis
// publicados e de empresas não bloqueadas, montadas campo a campo (nunca o registro do Prisma). Visitante lê tudo;
// escrever exige sessão, e-mail confirmado, o módulo da rede e perfil publicado (ver exigirParticipante).

const selecaoAutor = {
  id: true,
  slug: true,
  nome: true,
  cidade: true,
  estado: true,
  status: true,
  profissoes: { select: { profissao: { select: { nome: true, ativo: true } } } },
  arquivos: { where: { finalidade: "logo" as const }, orderBy: { criadoEm: "desc" as const }, select: { id: true }, take: 1 },
  empresa: { select: { verificadaEm: true } },
} satisfies Prisma.PerfilPublicoSelect;

type AutorBruto = Prisma.PerfilPublicoGetPayload<{ select: typeof selecaoAutor }>;

function paraAutor(p: AutorBruto): AutorPostagem {
  const profissao = p.profissoes
    .filter((x) => x.profissao.ativo)
    .map((x) => x.profissao.nome)
    .sort((a, b) => a.localeCompare(b, "pt-BR"))[0];
  const local = p.cidade && p.estado ? `${p.cidade}/${p.estado}` : (p.cidade ?? p.estado ?? undefined);
  return {
    perfilId: p.id,
    slug: p.slug,
    nome: p.nome,
    resumo: [profissao, local].filter(Boolean).join(" · "),
    logoUrl: p.arquivos[0] ? `/api/arquivos/${p.arquivos[0].id}` : undefined,
    verificado: !!p.empresa?.verificadaEm,
  };
}

const ondeVisivel = {
  status: "publicada",
  perfil: { status: "publicado" },
  empresa: { bloqueadaEm: null },
} satisfies Prisma.PostagemWhereInput;

export async function listarFeed(
  visitante: Pick<SessaoValida, "empresaId"> | null,
  cursor: string | null,
  filtroPerfilId?: string,
): Promise<PaginaFeed> {
  const c = cursor ? decodificarCursor(cursor) : null;
  const linhas = await prisma.postagem.findMany({
    where: {
      ...ondeVisivel,
      ...(filtroPerfilId ? { perfilId: filtroPerfilId } : {}),
      ...(c ? { OR: [{ criadoEm: { lt: c.criadoEm } }, { criadoEm: c.criadoEm, id: { lt: c.id } }] } : {}),
    },
    orderBy: [{ criadoEm: "desc" }, { id: "desc" }],
    take: TAMANHO_PAGINA_FEED + 1,
    select: {
      id: true,
      texto: true,
      criadoEm: true,
      empresaId: true,
      perfil: { select: selecaoAutor },
      fotos: { orderBy: { ordem: "asc" }, select: { id: true, arquivoId: true } },
      _count: { select: { curtidas: true, comentarios: { where: { status: "publicada" } } } },
    },
  });

  const temMais = linhas.length > TAMANHO_PAGINA_FEED;
  const pagina = temMais ? linhas.slice(0, TAMANHO_PAGINA_FEED) : linhas;
  const curtidas =
    visitante && pagina.length > 0
      ? await prisma.postagemCurtida.findMany({
          where: { empresaId: visitante.empresaId, postagemId: { in: pagina.map((l) => l.id) } },
          select: { postagemId: true },
        })
      : [];
  const curtidasDoVisitante = new Set(curtidas.map((x) => x.postagemId));

  const itens: PostagemItem[] = pagina.map((l) => ({
    id: l.id,
    texto: l.texto,
    criadoEm: l.criadoEm,
    fotos: l.fotos.map((f) => ({ id: f.id, url: `/api/arquivos/${f.arquivoId}` })),
    autor: paraAutor(l.perfil),
    curtidas: l._count.curtidas,
    comentarios: l._count.comentarios,
    curtiu: curtidasDoVisitante.has(l.id),
    minha: !!visitante && l.empresaId === visitante.empresaId,
  }));
  const ultimo = pagina[pagina.length - 1];
  return { itens, proximo: temMais && ultimo ? codificarCursor({ criadoEm: ultimo.criadoEm, id: ultimo.id }) : null };
}

export async function listarComentarios(
  visitante: Pick<SessaoValida, "empresaId"> | null,
  postagemId: string,
): Promise<ComentarioItem[]> {
  const visivel = await prisma.postagem.findFirst({ where: { id: postagemId, ...ondeVisivel }, select: { id: true } });
  if (!visivel) return [];
  const linhas = await prisma.comentarioPostagem.findMany({
    where: { postagemId, status: "publicada", perfil: { status: "publicado" }, empresa: { bloqueadaEm: null } },
    orderBy: [{ criadoEm: "desc" }, { id: "desc" }],
    take: COMENTARIOS_POR_PAGINA,
    select: { id: true, texto: true, criadoEm: true, empresaId: true, perfil: { select: selecaoAutor } },
  });
  return linhas.reverse().map((l) => {
    const autor = paraAutor(l.perfil);
    return {
      id: l.id,
      texto: l.texto,
      criadoEm: l.criadoEm,
      autor: { slug: autor.slug, nome: autor.nome, logoUrl: autor.logoUrl },
      meu: !!visitante && l.empresaId === visitante.empresaId,
    };
  });
}

/** Quem pode publicar e interagir. Visitante e conta sem perfil publicado só leem. */
export async function situacaoNoFeed(sessao: SessaoValida | null): Promise<SituacaoFeed> {
  if (!sessao) return { logado: false, podeInteragir: false };
  try {
    await exigirParticipante(sessao);
    return { logado: true, podeInteragir: true };
  } catch {
    return { logado: true, podeInteragir: false };
  }
}

/**
 * Barreira de escrita no feed: a pessoa precisa ter o módulo da rede, e-mail confirmado e um perfil PUBLICADO (o cartão
 * da postagem mostra o perfil, então rascunho ou suspenso não fala em nome da empresa). Devolve o perfil que assina.
 */
export async function exigirParticipante(sessao: SessaoValida): Promise<{ perfilId: string }> {
  if (!sessao.emailConfirmado) {
    throw new ErroDeNegocio(`Confirme seu e-mail para participar da comunidade. Enviamos um link para ${sessao.email}.`);
  }
  const recursos = await obterRecursosDaEmpresa(sessao.empresaId);
  if (!recursos.has("rede") || !temAlgumModulo(sessao, ["rede"])) {
    throw new ErroDeNegocio("O seu acesso não inclui o Elo Profissionais.");
  }
  const [perfil, empresa] = await Promise.all([
    prisma.perfilPublico.findUnique({ where: { empresaId: sessao.empresaId }, select: { id: true, status: true } }),
    prisma.empresa.findUnique({ where: { id: sessao.empresaId }, select: { bloqueadaEm: true } }),
  ]);
  if (!perfil || perfil.status !== "publicado") {
    throw new ErroDeNegocio("Publique o seu perfil no Elo Profissionais para participar da comunidade.");
  }
  if (empresa?.bloqueadaEm) throw new ErroDeNegocio("Esta conta está bloqueada.");
  return { perfilId: perfil.id };
}

/** O perfil público da empresa (para montar o link do "Perfil" e o nome que assina a postagem). */
export async function perfilDaEmpresa(empresaId: string): Promise<{ slug: string; nome: string; status: string } | null> {
  return prisma.perfilPublico.findUnique({ where: { empresaId }, select: { slug: true, nome: true, status: true } });
}
