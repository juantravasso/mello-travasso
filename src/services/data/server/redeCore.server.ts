import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { extrairIpConfiavel, verificarLimite } from "@/lib/auth/limite";
import { filtrosBuscaSchema } from "@/lib/validacao/rede";
import { gerarSlug, normalizarBusca } from "@/lib/rede/texto";
import type {
  CategoriaItem,
  FiltrosBuscaPerfil,
  PerfilPublicoCompleto,
  PerfilPublicoResumo,
  ResultadoBuscaPerfil,
} from "@/types";

// Leitura pública da rede. É o único lugar do app que lê dados de empresas
// diferentes sem filtrar por empresaId da sessão — por isso só devolve DTOs
// montados campo a campo (lista branca), nunca o registro do Prisma, e só de
// perfis com status "publicado". Telefone e WhatsApp só saem quando o dono os
// marcou como públicos.

export const TAMANHO_PAGINA_BUSCA = 12;

function termoLiteral(texto: string): string {
  return normalizarBusca(texto).replace(/[%_\\]/g, " ").replace(/\s+/g, " ").trim();
}
const BUSCAS_POR_MINUTO = 60;

type PerfilComProfissoes = Prisma.PerfilPublicoGetPayload<{
  include: { profissoes: { include: { profissao: true } } };
}>;

const incluirProfissoes = { profissoes: { include: { profissao: true } } } as const;

function nomesDeProfissoesAtivas(perfil: PerfilComProfissoes): string[] {
  return perfil.profissoes
    .filter((pp) => pp.profissao.ativo)
    .map((pp) => pp.profissao.nome)
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function resumir(texto: string | null, max: number): string | undefined {
  if (!texto) return undefined;
  return texto.length > max ? `${texto.slice(0, max).trimEnd()}…` : texto;
}

function paraResumo(perfil: PerfilComProfissoes): PerfilPublicoResumo {
  return {
    slug: perfil.slug,
    tipo: perfil.tipo,
    nome: perfil.nome,
    nomeFantasia: perfil.nomeFantasia ?? undefined,
    descricao: resumir(perfil.descricao, 180),
    cidade: perfil.cidade ?? undefined,
    estado: perfil.estado ?? undefined,
    profissoes: nomesDeProfissoesAtivas(perfil),
  };
}

function paraCompleto(perfil: PerfilComProfissoes): PerfilPublicoCompleto {
  return {
    ...paraResumo(perfil),
    descricao: perfil.descricao ?? undefined,
    regiao: perfil.regiao ?? undefined,
    areasAtendimento: perfil.areasAtendimento,
    telefone: perfil.telefonePublico ? (perfil.telefone ?? undefined) : undefined,
    whatsapp: perfil.whatsappPublico ? (perfil.whatsapp ?? undefined) : undefined,
    instagram: perfil.instagram ?? undefined,
    site: perfil.site ?? undefined,
    profissoesDetalhe: perfil.profissoes
      .filter((pp) => pp.profissao.ativo)
      .map((pp) => ({ nome: pp.profissao.nome, slug: pp.profissao.slug }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    criadoEm: perfil.criadoEm,
  };
}

/** Taxonomia ativa (categorias e subcategorias com suas profissões), em ordem estável. */
export async function listarTaxonomia(incluirInativos = false): Promise<CategoriaItem[]> {
  const categorias = await prisma.categoria.findMany({
    where: incluirInativos ? undefined : { ativo: true },
    include: { profissoes: { where: incluirInativos ? undefined : { ativo: true }, orderBy: { nome: "asc" } } },
    orderBy: [{ ordem: "asc" }, { nome: "asc" }],
  });
  return categorias.map((c) => ({
    id: c.id,
    nome: c.nome,
    slug: c.slug,
    paiId: c.paiId ?? undefined,
    ordem: c.ordem,
    ativo: c.ativo,
    profissoes: c.profissoes.map((p) => ({
      id: p.id,
      nome: p.nome,
      slug: p.slug,
      categoriaId: p.categoriaId,
      ativo: p.ativo,
    })),
  }));
}

export async function buscarPerfisPublicos(filtrosBrutos: FiltrosBuscaPerfil): Promise<ResultadoBuscaPerfil> {
  const vazio: ResultadoBuscaPerfil = { itens: [], total: 0, pagina: 1, totalPaginas: 0 };

  const limite = await verificarLimite(
    `rede-busca:${extrairIpConfiavel(await headers())}`,
    BUSCAS_POR_MINUTO,
    60_000,
  );
  if (!limite.permitido) return { ...vazio, limiteExcedido: true };

  const parsed = filtrosBuscaSchema.safeParse(filtrosBrutos);
  if (!parsed.success) return vazio;
  const { q, profissao, categoria, estado, cidade, tipo, pagina = 1 } = parsed.data;

  const condicoes: Prisma.PerfilPublicoWhereInput[] = [{ status: "publicado" }];

  // % e _ são curingas do LIKE (o Prisma não os escapa em `contains`): sem
  // tirá-los, "%" casaria todos os perfis e padrões longos pesariam no banco.
  const termo = q ? termoLiteral(q) : "";
  if (termo) {
    condicoes.push({
      OR: [
        { nomeBusca: { contains: termo } },
        // Busca por profissão digitada livremente ("eletricista"): o slug da
        // profissão já é minúsculo e sem acento.
        { profissoes: { some: { profissao: { ativo: true, slug: { contains: gerarSlug(termo, 80) } } } } },
      ],
    });
  }
  if (profissao) condicoes.push({ profissoes: { some: { profissao: { ativo: true, slug: profissao } } } });
  if (categoria) {
    condicoes.push({
      profissoes: {
        some: {
          profissao: { ativo: true, categoria: { OR: [{ slug: categoria }, { pai: { slug: categoria } }] } },
        },
      },
    });
  }
  if (estado) condicoes.push({ estado });
  const termoCidade = cidade ? termoLiteral(cidade) : "";
  if (termoCidade) condicoes.push({ cidadeBusca: { contains: termoCidade } });
  if (tipo) condicoes.push({ tipo });

  const where: Prisma.PerfilPublicoWhereInput = { AND: condicoes };
  const [total, perfis] = await Promise.all([
    prisma.perfilPublico.count({ where }),
    prisma.perfilPublico.findMany({
      where,
      include: incluirProfissoes,
      orderBy: [{ nome: "asc" }, { id: "asc" }],
      skip: (pagina - 1) * TAMANHO_PAGINA_BUSCA,
      take: TAMANHO_PAGINA_BUSCA,
    }),
  ]);

  return {
    itens: perfis.map(paraResumo),
    total,
    pagina,
    totalPaginas: Math.ceil(total / TAMANHO_PAGINA_BUSCA),
  };
}

// cache() por request: generateMetadata e a página chamam isto com o mesmo slug.
export const obterPerfilPublicoPorSlug = cache(async (slug: string): Promise<PerfilPublicoCompleto | null> => {
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return null;
  const perfil = await prisma.perfilPublico.findFirst({
    where: { slug, status: "publicado" },
    include: incluirProfissoes,
  });
  return perfil ? paraCompleto(perfil) : null;
});

export async function listarPerfisRecentes(quantidade: number): Promise<PerfilPublicoResumo[]> {
  const perfis = await prisma.perfilPublico.findMany({
    where: { status: "publicado" },
    include: incluirProfissoes,
    orderBy: [{ criadoEm: "desc" }, { id: "asc" }],
    take: quantidade,
  });
  return perfis.map(paraResumo);
}

export async function listarSlugsPublicados(): Promise<{ slug: string; atualizadoEm: string }[]> {
  return prisma.perfilPublico.findMany({
    where: { status: "publicado" },
    select: { slug: true, atualizadoEm: true },
    orderBy: { criadoEm: "desc" },
    take: 5000,
  });
}

/** Cidades (nomes como digitados pelos perfis publicados) — sem lista fixa embutida. */
export async function listarCidadesPublicas(estado: string | undefined, termo: string): Promise<string[]> {
  const busca = termoLiteral(termo);
  const linhas = await prisma.perfilPublico.findMany({
    where: {
      status: "publicado",
      cidade: { not: null },
      ...(estado ? { estado } : {}),
      ...(busca ? { cidadeBusca: { contains: busca } } : {}),
    },
    select: { cidade: true },
    distinct: ["cidadeBusca"],
    orderBy: { cidade: "asc" },
    take: 10,
  });
  return linhas.map((l) => l.cidade).filter((c): c is string => c !== null);
}
