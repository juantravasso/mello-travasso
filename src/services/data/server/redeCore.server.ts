import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { extrairIpConfiavel, verificarLimite } from "@/lib/auth/limite";
import { filtrosBuscaSchema } from "@/lib/validacao/rede";
import { gerarSlug, normalizarBusca } from "@/lib/rede/texto";
import { SIGLAS_UF } from "@/lib/rede/ufs";
import type {
  CategoriaItem,
  FiltrosBuscaPerfil,
  PerfilPublicoCompleto,
  PerfilPublicoResumo,
  ResultadoBuscaPerfil,
} from "@/types";
import { obterResumo, resumosPorPerfil, STATUS_VISIVEIS } from "./avaliacaoCore.server";

// Leitura pública da rede. É o único lugar do app que lê dados de empresas
// diferentes sem filtrar por empresaId da sessão — por isso só devolve DTOs
// montados campo a campo (lista branca), nunca o registro do Prisma, e só de
// perfis visíveis (publicado ou indicado). Telefone e WhatsApp só saem quando o
// dono os marcou como públicos; perfis indicados nunca têm contato.

export const TAMANHO_PAGINA_BUSCA = 12;
const BUSCAS_POR_MINUTO = 60;

const statusVisiveis = [...STATUS_VISIVEIS];

function termoLiteral(texto: string): string {
  return normalizarBusca(texto).replace(/[%_\\]/g, " ").replace(/\s+/g, " ").trim();
}

const incluirProfissoes = {
  profissoes: { include: { profissao: true } },
  arquivos: { where: { finalidade: "logo" as const }, orderBy: { criadoEm: "desc" as const }, select: { id: true }, take: 1 },
  empresa: { select: { verificadaEm: true } },
} as const;

type PerfilComProfissoes = Prisma.PerfilPublicoGetPayload<{ include: typeof incluirProfissoes }>;

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

function paraResumo(
  perfil: PerfilComProfissoes,
  avaliacao?: { media: number; total: number },
  distanciaKm?: number,
): PerfilPublicoResumo {
  return {
    slug: perfil.slug,
    tipo: perfil.tipo,
    nome: perfil.nome,
    nomeFantasia: perfil.nomeFantasia ?? undefined,
    descricao: resumir(perfil.descricao, 180),
    cidade: perfil.cidade ?? undefined,
    estado: perfil.estado ?? undefined,
    profissoes: nomesDeProfissoesAtivas(perfil),
    indicado: perfil.status === "indicado",
    verificado: perfil.status === "publicado" && !!perfil.empresa?.verificadaEm,
    logoUrl: perfil.status === "publicado" && perfil.arquivos[0] ? `/api/arquivos/${perfil.arquivos[0].id}` : undefined,
    avaliacao,
    distanciaKm,
  };
}

function paraCompleto(
  perfil: PerfilComProfissoes,
  resumo: PerfilPublicoCompleto["resumo"],
  portfolio: { servicos: PerfilPublicoCompleto["servicos"]; galerias: PerfilPublicoCompleto["galerias"] },
): PerfilPublicoCompleto {
  const publicado = perfil.status === "publicado";
  return {
    ...paraResumo(perfil),
    descricao: perfil.descricao ?? undefined,
    regiao: perfil.regiao ?? undefined,
    areasAtendimento: perfil.areasAtendimento,
    telefone: publicado && perfil.telefonePublico ? (perfil.telefone ?? undefined) : undefined,
    whatsapp: publicado && perfil.whatsappPublico ? (perfil.whatsapp ?? undefined) : undefined,
    instagram: publicado ? (perfil.instagram ?? undefined) : undefined,
    site: publicado ? (perfil.site ?? undefined) : undefined,
    profissoesDetalhe: perfil.profissoes
      .filter((pp) => pp.profissao.ativo)
      .map((pp) => ({ nome: pp.profissao.nome, slug: pp.profissao.slug }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    criadoEm: perfil.criadoEm,
    resumo,
    servicos: portfolio.servicos,
    galerias: portfolio.galerias,
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
  const { q, profissao, categoria, estado, cidade, tipo, notaMin, raioKm, pagina = 1 } = parsed.data;
  const termoCidade = cidade ? termoLiteral(cidade) : "";

  // Raio: o centro é o município oficial (estado + nome exato). Sem ele não há como medir distância:
  // busca só pelo nome da cidade e avisa.
  let distancias: Map<string, number> | undefined;
  let raio: ResultadoBuscaPerfil["raio"];
  let raioIgnorado = false;
  if (raioKm && estado && termoCidade) {
    const centro = await prisma.municipio.findUnique({ where: { uf_nomeBusca: { uf: estado, nomeBusca: termoCidade } } });
    if (centro) {
      distancias = await perfisNoRaio(centro, raioKm);
      raio = { cidade: centro.nome, estado: centro.uf, km: raioKm };
    } else {
      raioIgnorado = true;
    }
  }

  const condicoes: Prisma.PerfilPublicoWhereInput[] = [{ status: { in: statusVisiveis } }];

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
  if (distancias) {
    // O raio já inclui a própria cidade (distância 0): estado e cidade não restringem mais.
    condicoes.push({ id: { in: [...distancias.keys()] } });
  } else {
    if (estado) condicoes.push({ estado });
    if (termoCidade) condicoes.push({ cidadeBusca: { contains: termoCidade } });
  }
  if (tipo) condicoes.push({ tipo });
  // Sem nenhum filtro, a listagem (indexável) não mostra autônomo indicado por
  // terceiros: o nome civil de uma pessoa não entra numa lista aberta sem que
  // ela tenha publicado nada. O perfil continua acessível pelo link e pela busca.
  if (!termo && !profissao && !categoria && !estado && !termoCidade && !tipo && !notaMin) {
    condicoes.push({ NOT: { status: "indicado", tipo: "pf" } });
  }
  if (notaMin) {
    // Média calculada sobre as avaliações publicadas — nunca um número gravado.
    const grupos = await prisma.avaliacao.groupBy({
      by: ["perfilId"],
      where: { status: "publicada" },
      having: { nota: { _avg: { gte: notaMin } } },
    });
    condicoes.push({ id: { in: grupos.map((g) => g.perfilId) } });
  }

  const where: Prisma.PerfilPublicoWhereInput = { AND: condicoes };
  let total: number;
  let perfis: PerfilComProfissoes[];
  if (distancias) {
    // Ordem por distância não existe no Prisma: acha quem passa nos filtros, ordena aqui (no máximo
    // 2000 ids vindos do raio) e só então carrega a página.
    const mapa = distancias;
    const achados = await prisma.perfilPublico.findMany({ where, select: { id: true, nome: true } });
    const ordenados = achados.sort(
      (a, b) =>
        (mapa.get(a.id) ?? 0) - (mapa.get(b.id) ?? 0) || a.nome.localeCompare(b.nome, "pt-BR") || a.id.localeCompare(b.id),
    );
    total = ordenados.length;
    const idsPagina = ordenados.slice((pagina - 1) * TAMANHO_PAGINA_BUSCA, pagina * TAMANHO_PAGINA_BUSCA).map((p) => p.id);
    const carregados = await prisma.perfilPublico.findMany({ where: { id: { in: idsPagina } }, include: incluirProfissoes });
    const porId = new Map(carregados.map((p) => [p.id, p]));
    perfis = idsPagina.map((id) => porId.get(id)).filter((p): p is PerfilComProfissoes => p !== undefined);
  } else {
    [total, perfis] = await Promise.all([
      prisma.perfilPublico.count({ where }),
      prisma.perfilPublico.findMany({
        where,
        include: incluirProfissoes,
        orderBy: [{ nome: "asc" }, { id: "asc" }],
        skip: (pagina - 1) * TAMANHO_PAGINA_BUSCA,
        take: TAMANHO_PAGINA_BUSCA,
      }),
    ]);
  }
  const resumos = await resumosPorPerfil(perfis.map((p) => p.id));

  return {
    itens: perfis.map((p) => paraResumo(p, resumos.get(p.id), distancias ? Math.round(distancias.get(p.id) ?? 0) : undefined)),
    total,
    pagina,
    totalPaginas: Math.ceil(total / TAMANHO_PAGINA_BUSCA),
    raio,
    raioIgnorado: raioIgnorado || undefined,
  };
}

/**
 * Perfis visíveis dentro do raio, com a distância (km, em linha reta) entre o centro da cidade
 * pesquisada e o da cidade de cada perfil — precisão de cidade, não de endereço. O caixote
 * (latitude/longitude) corta a tabela de municípios antes da fórmula de haversine.
 */
async function perfisNoRaio(centro: { latitude: number; longitude: number }, raioKm: number): Promise<Map<string, number>> {
  const dLat = raioKm / 111;
  const dLon = raioKm / (111 * Math.max(Math.cos((centro.latitude * Math.PI) / 180), 0.2));
  const linhas = await prisma.$queryRaw<{ id: string; km: number }[]>`
    SELECT p."id", d."km"
    FROM "PerfilPublico" p
    JOIN (
      SELECT m."uf", m."nomeBusca",
        2 * 6371 * asin(sqrt(LEAST(1.0,
          power(sin(radians(m."latitude" - ${centro.latitude}::float8) / 2), 2) +
          cos(radians(${centro.latitude}::float8)) * cos(radians(m."latitude")) *
          power(sin(radians(m."longitude" - ${centro.longitude}::float8) / 2), 2)
        ))) AS "km"
      FROM "Municipio" m
      WHERE m."latitude" BETWEEN ${centro.latitude - dLat}::float8 AND ${centro.latitude + dLat}::float8
        AND m."longitude" BETWEEN ${centro.longitude - dLon}::float8 AND ${centro.longitude + dLon}::float8
    ) d ON d."uf" = p."estado" AND d."nomeBusca" = p."cidadeBusca"
    WHERE p."status" IN ('publicado', 'indicado')
      AND d."km" <= ${raioKm}::float8
    ORDER BY d."km", p."id"
    LIMIT 2000`;
  return new Map(linhas.map((l) => [l.id, Number(l.km)]));
}

/** Serviços e trabalhos (agrupados por galeria) de um perfil já verificado como publicado. */
async function carregarPortfolioPublico(perfilId: string) {
  const [servicos, trabalhos] = await Promise.all([
    prisma.servico.findMany({ where: { perfilId }, orderBy: [{ ordem: "asc" }, { id: "asc" }], select: { nome: true, descricao: true } }),
    prisma.trabalho.findMany({
      where: { perfilId },
      orderBy: [{ ordem: "asc" }, { id: "asc" }],
      select: {
        id: true,
        titulo: true,
        descricao: true,
        galeria: true,
        dataTrabalho: true,
        servico: { select: { nome: true } },
        fotos: { orderBy: [{ ordem: "asc" }, { id: "asc" }], select: { arquivoId: true } },
      },
    }),
  ]);
  const porGaleria = new Map<string, PerfilPublicoCompleto["galerias"][number]>();
  for (const t of trabalhos) {
    const chave = t.galeria ?? "";
    const galeria = porGaleria.get(chave) ?? { nome: t.galeria ?? undefined, trabalhos: [] };
    galeria.trabalhos.push({
      id: t.id,
      titulo: t.titulo,
      descricao: t.descricao ?? undefined,
      servico: t.servico?.nome,
      dataTrabalho: t.dataTrabalho ?? undefined,
      fotos: t.fotos.map((f) => f.arquivoId),
    });
    porGaleria.set(chave, galeria);
  }
  return {
    servicos: servicos.map((s) => ({ nome: s.nome, descricao: s.descricao ?? undefined })),
    galerias: [...porGaleria.values()],
  };
}

export interface PerfilPublicoComContexto {
  perfil: PerfilPublicoCompleto;
  /** Só para uso no servidor (consultas de avaliação e estado do visitante); nunca vai para o client. */
  id: string;
  empresaId: string | null;
  documentoIndicado: string | null;
  indicadoPorEmpresaId: string | null;
}

/** Links para as páginas locais que listam este perfil (publicado, com cidade da base de municípios). */
async function linksLocais(perfil: PerfilComProfissoes): Promise<PerfilPublicoCompleto["locais"]> {
  if (perfil.status !== "publicado" || !perfil.estado || !perfil.cidadeBusca) return undefined;
  const municipio = await prisma.municipio.findUnique({
    where: { uf_nomeBusca: { uf: perfil.estado, nomeBusca: perfil.cidadeBusca } },
    select: { nome: true, uf: true },
  });
  if (!municipio) return undefined;
  return perfil.profissoes
    .filter((pp) => pp.profissao.ativo)
    .slice(0, 6)
    .map((pp) => ({
      rotulo: `${pp.profissao.nome} em ${municipio.nome}/${municipio.uf}`,
      href: `/rede/${pp.profissao.slug}/${municipio.uf.toLowerCase()}/${gerarSlug(municipio.nome, 80)}`,
    }));
}

// cache() por request: generateMetadata e a página chamam isto com o mesmo slug.
export const obterPerfilPublicoPorSlug = cache(async (slug: string): Promise<PerfilPublicoComContexto | null> => {
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return null;
  const registro = await prisma.perfilPublico.findFirst({
    where: { slug, status: { in: statusVisiveis } },
    include: incluirProfissoes,
  });
  if (!registro) return null;
  const [resumo, portfolio, locais] = await Promise.all([
    obterResumo(registro.id),
    registro.status === "publicado" ? carregarPortfolioPublico(registro.id) : { servicos: [], galerias: [] },
    linksLocais(registro),
  ]);
  return {
    perfil: { ...paraCompleto(registro, resumo, portfolio), locais },
    id: registro.id,
    empresaId: registro.empresaId,
    documentoIndicado: registro.documentoIndicado,
    indicadoPorEmpresaId: registro.indicadoPorEmpresaId,
  };
});

export async function listarPerfisRecentes(quantidade: number): Promise<PerfilPublicoResumo[]> {
  const perfis = await prisma.perfilPublico.findMany({
    where: { status: { in: statusVisiveis }, NOT: { status: "indicado", tipo: "pf" } },
    include: incluirProfissoes,
    orderBy: [{ criadoEm: "desc" }, { id: "asc" }],
    take: quantidade,
  });
  const resumos = await resumosPorPerfil(perfis.map((p) => p.id));
  return perfis.map((p) => paraResumo(p, resumos.get(p.id)));
}

/** Só perfis publicados pelo próprio dono entram no sitemap; indicados por terceiros ficam de fora. */
export async function listarSlugsPublicados(): Promise<{ slug: string; atualizadoEm: string }[]> {
  return prisma.perfilPublico.findMany({
    where: { status: "publicado" },
    select: { slug: true, atualizadoEm: true },
    orderBy: { criadoEm: "desc" },
    take: 5000,
  });
}

/** Sugestões de cidade vindas da base de municípios (nome oficial, o mesmo usado no raio). */
export async function listarCidadesPublicas(estado: string | undefined, termo: string): Promise<string[]> {
  const busca = termoLiteral(termo);
  if (!busca) return [];
  const linhas = await prisma.municipio.findMany({
    where: { nomeBusca: { contains: busca }, ...(estado ? { uf: estado } : {}) },
    select: { nome: true },
    orderBy: [{ nome: "asc" }],
    take: 40,
  });
  return [...new Set(linhas.map((l) => l.nome))].slice(0, 10);
}

// --- Páginas locais (profissão + cidade), indexáveis ------------------------

export interface LocalProfissao {
  profissao: { id: string; nome: string; slug: string };
  municipio: { nome: string; nomeBusca: string; uf: string };
}

// A tabela de municípios é estática (IBGE): guarda em memória, por estado, o índice slug → município.
// Tabela vazia não é guardada, para a página voltar a funcionar assim que o import rodar.
const municipiosPorUf = new Map<string, Map<string, { nome: string; nomeBusca: string }>>();

async function municipiosDaUf(uf: string) {
  let indice = municipiosPorUf.get(uf);
  if (!indice) {
    const linhas = await prisma.municipio.findMany({ where: { uf }, select: { nome: true, nomeBusca: true } });
    indice = new Map(linhas.map((m) => [gerarSlug(m.nome, 80), m]));
    if (linhas.length > 0) municipiosPorUf.set(uf, indice);
  }
  return indice;
}

/** Limite de visitas às páginas locais por IP; compartilhado (cache por request) entre generateMetadata e a página. */
export const visitaLocalPermitida = cache(async (): Promise<boolean> => {
  const limite = await verificarLimite(`rede-local:${extrairIpConfiavel(await headers())}`, 120, 60_000);
  return limite.permitido;
});

/** Resolve /rede/[profissao]/[uf]/[cidade]; null (404) se a profissão, o estado ou a cidade não existem. */
export const obterLocalPorSlugs = cache(
  async (profissaoSlug: string, ufMinusculo: string, cidadeSlug: string): Promise<LocalProfissao | null> => {
    const padrao = /^[a-z0-9-]{1,80}$/;
    if (!/^[a-z]{2}$/.test(ufMinusculo) || !padrao.test(profissaoSlug) || !padrao.test(cidadeSlug)) return null;
    const uf = ufMinusculo.toUpperCase();
    if (!SIGLAS_UF.includes(uf)) return null;
    const municipio = (await municipiosDaUf(uf)).get(cidadeSlug);
    if (!municipio) return null;
    const profissao = await prisma.profissao.findFirst({ where: { slug: profissaoSlug, ativo: true }, select: { id: true, nome: true, slug: true } });
    if (!profissao) return null;
    return { profissao, municipio: { ...municipio, uf } };
  },
);

/** Só perfis publicados pelo dono (mesma regra do sitemap): indicados por terceiros não viram página local. */
// cache() por request: generateMetadata e a página pedem a mesma lista (mesmo objeto `local`).
export const listarPerfisLocais = cache(async function listarPerfisLocais(
  local: LocalProfissao,
  pagina: number,
): Promise<{ itens: PerfilPublicoResumo[]; total: number; totalPaginas: number }> {
  const where: Prisma.PerfilPublicoWhereInput = {
    status: "publicado",
    estado: local.municipio.uf,
    cidadeBusca: local.municipio.nomeBusca,
    profissoes: { some: { profissaoId: local.profissao.id } },
  };
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
  const resumos = await resumosPorPerfil(perfis.map((p) => p.id));
  return {
    itens: perfis.map((p) => paraResumo(p, resumos.get(p.id))),
    total,
    totalPaginas: Math.ceil(total / TAMANHO_PAGINA_BUSCA),
  };
});

export interface LocalIndexavel {
  href: string;
  atualizadoEm: string;
}

/** Combinações profissão × cidade com ao menos um perfil publicado: só elas entram no sitemap (sem página vazia). */
export async function listarLocaisIndexaveis(): Promise<LocalIndexavel[]> {
  const pares = await prisma.perfilProfissao.findMany({
    where: { profissao: { ativo: true }, perfil: { status: "publicado", estado: { not: null }, cidadeBusca: { not: null } } },
    select: {
      profissao: { select: { slug: true } },
      perfil: { select: { estado: true, cidadeBusca: true, atualizadoEm: true } },
    },
    orderBy: [{ perfilId: "asc" }, { profissaoId: "asc" }],
    take: 20000,
  });
  if (pares.length === 20000) console.warn("[sitemap] listarLocaisIndexaveis atingiu 20000 pares: sitemap local truncado.");
  const combinacoes = new Map<string, { profissao: string; uf: string; cidadeBusca: string; atualizadoEm: string }>();
  for (const p of pares) {
    if (!p.perfil.estado || !p.perfil.cidadeBusca) continue;
    const chave = `${p.profissao.slug}|${p.perfil.estado}|${p.perfil.cidadeBusca}`;
    const atual = combinacoes.get(chave);
    if (!atual || atual.atualizadoEm < p.perfil.atualizadoEm) {
      combinacoes.set(chave, { profissao: p.profissao.slug, uf: p.perfil.estado, cidadeBusca: p.perfil.cidadeBusca, atualizadoEm: p.perfil.atualizadoEm });
    }
  }
  if (combinacoes.size === 0) return [];
  const ufs = [...new Set([...combinacoes.values()].map((c) => c.uf))];
  const municipios = await prisma.municipio.findMany({ where: { uf: { in: ufs } }, select: { uf: true, nome: true, nomeBusca: true } });
  const nomes = new Map(municipios.map((m) => [`${m.uf}|${m.nomeBusca}`, m.nome]));
  const saida: LocalIndexavel[] = [];
  for (const c of combinacoes.values()) {
    const nome = nomes.get(`${c.uf}|${c.cidadeBusca}`);
    if (!nome) continue; // cidade digitada fora da base de municípios: sem página local
    saida.push({ href: `/rede/${c.profissao}/${c.uf.toLowerCase()}/${gerarSlug(nome, 80)}`, atualizadoEm: c.atualizadoEm });
    if (saida.length >= 5000) break;
  }
  return saida;
}
