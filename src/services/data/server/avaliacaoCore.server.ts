import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verificarLimite } from "@/lib/auth/limite";
import type {
  AvaliacaoPublica,
  EstadoInteracao,
  PaginaAvaliacoes,
  ResumoAvaliacoes,
} from "@/types";
import { ErroDeNegocio } from "./resultado.server";

export const TAMANHO_PAGINA_AVALIACOES = 10;
export const IDADE_MINIMA_CONTA_MS = 24 * 60 * 60 * 1000;
export const CANAL_CONTESTACAO = "contato@mellotravasso.com.br";
const RECOMENDACOES_POR_DIA = 60;
const UM_DIA_MS = 24 * 60 * 60 * 1000;

/** Perfis que podem receber avaliação e recomendação: os visíveis ao público. */
export const STATUS_VISIVEIS = ["publicado", "indicado"] as const;

interface EmpresaParaNome {
  tipoPessoa: "pj" | "pf";
  nomeFantasia: string | null;
  razaoSocial: string;
  perfilPublico: { nome: string; slug: string; status: string } | null;
}

export const selecaoEmpresaParaNome = {
  tipoPessoa: true,
  nomeFantasia: true,
  razaoSocial: true,
  perfilPublico: { select: { nome: true, slug: true, status: true } },
} as const;

// Razão social de MEI vem como "NOME CIVIL 12345678900": nunca vai a público.
const PARECE_DOCUMENTO = /\d{3}\.?\d{3}\.?\d{3}-?\d{2}|\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}|\d{11}/;

/**
 * Nome com que uma empresa aparece em avaliações e respostas. Perfil publicado:
 * o nome que ela escolheu. Empresa (PJ) sem perfil publicado: nome fantasia ou
 * razão social (dado público de CNPJ), exceto se o texto carrega um número de
 * documento (MEI). Autônomo (PF) sem perfil publicado: nome genérico, para
 * nunca expor o nome civil sem que ele tenha publicado.
 */
export function nomePublicoDaEmpresa(empresa: EmpresaParaNome): { nome: string; slug?: string } {
  if (empresa.perfilPublico?.status === "publicado") {
    return { nome: empresa.perfilPublico.nome, slug: empresa.perfilPublico.slug };
  }
  if (empresa.tipoPessoa === "pj") {
    const nome = empresa.nomeFantasia ?? empresa.razaoSocial;
    return { nome: PARECE_DOCUMENTO.test(nome) ? "Empresa da rede" : nome };
  }
  return { nome: "Profissional da rede" };
}

/**
 * Nome de uma empresa para a administração (fila de denúncias): o suficiente
 * para distinguir quem é, sem despejar CPF de MEI ou nome civil de autônomo.
 * O sufixo curto do id separa homônimos.
 */
export function nomeParaAdmin(empresa: { id: string; tipoPessoa: "pj" | "pf"; nomeFantasia: string | null; razaoSocial: string }): string {
  const sufixo = ` #${empresa.id.slice(0, 6)}`;
  if (empresa.tipoPessoa === "pf") return `Autônomo${sufixo}`;
  const nome = empresa.nomeFantasia ?? empresa.razaoSocial;
  return `${PARECE_DOCUMENTO.test(nome) ? "Empresa (nome oculto)" : nome}${sufixo}`;
}

interface PerfilParaPosse {
  empresaId: string | null;
  documentoIndicado: string | null;
  indicadoPorEmpresaId: string | null;
}

/**
 * O perfil é "da própria empresa": ela é a dona, ou o perfil indicado traz o
 * CNPJ dela. Quem é o próprio perfil não avalia nem recomenda a si mesmo.
 * (Perfil indicado não é vinculado automaticamente a quem se cadastra com o
 * mesmo CNPJ — isso exige prova de posse, Fase 6.5 — mas já impede a
 * autoavaliação.)
 */
export function ehProprio(perfil: PerfilParaPosse, empresa: { id: string; documento: string }): boolean {
  return perfil.empresaId === empresa.id || (!!perfil.documentoIndicado && perfil.documentoIndicado === empresa.documento);
}

/** Quem criou o perfil por indicação pode recomendá-lo, mas não avaliá-lo. */
export function criouPerfil(perfil: PerfilParaPosse, empresaId: string): boolean {
  return perfil.indicadoPorEmpresaId === empresaId;
}

function arredondar(valor: number): number {
  return Math.round(valor * 100) / 100;
}

export async function obterResumo(perfilId: string): Promise<ResumoAvaliacoes> {
  const [grupos, recomendacoes] = await Promise.all([
    prisma.avaliacao.groupBy({
      by: ["nota"],
      where: { perfilId, status: "publicada" },
      _count: { _all: true },
    }),
    prisma.indicacao.count({ where: { perfilId } }),
  ]);
  const distribuicao: ResumoAvaliacoes["distribuicao"] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let total = 0;
  let soma = 0;
  for (const g of grupos) {
    if (g.nota >= 1 && g.nota <= 5) {
      distribuicao[g.nota as 1 | 2 | 3 | 4 | 5] = g._count._all;
      total += g._count._all;
      soma += g.nota * g._count._all;
    }
  }
  return { media: total > 0 ? arredondar(soma / total) : null, total, distribuicao, recomendacoes };
}

/** Média e total por perfil, para os cartões da busca. */
export async function resumosPorPerfil(perfilIds: string[]): Promise<Map<string, { media: number; total: number }>> {
  if (perfilIds.length === 0) return new Map();
  const grupos = await prisma.avaliacao.groupBy({
    by: ["perfilId"],
    where: { perfilId: { in: perfilIds }, status: "publicada" },
    _avg: { nota: true },
    _count: { _all: true },
  });
  return new Map(
    grupos.map((g) => [g.perfilId, { media: arredondar(g._avg.nota ?? 0), total: g._count._all }]),
  );
}

export async function listarAvaliacoesPublicas(
  perfilId: string,
  perfilNome: string,
  pagina: number,
): Promise<PaginaAvaliacoes> {
  const where: Prisma.AvaliacaoWhereInput = { perfilId, status: "publicada" };
  const [total, registros] = await Promise.all([
    prisma.avaliacao.count({ where }),
    prisma.avaliacao.findMany({
      where,
      include: { avaliador: { select: selecaoEmpresaParaNome }, resposta: true },
      orderBy: [{ criadoEm: "desc" }, { id: "asc" }],
      skip: (pagina - 1) * TAMANHO_PAGINA_AVALIACOES,
      take: TAMANHO_PAGINA_AVALIACOES,
    }),
  ]);

  const itens: AvaliacaoPublica[] = registros.map((a) => {
    const avaliador = nomePublicoDaEmpresa(a.avaliador);
    return {
      id: a.id,
      nota: a.nota,
      comentario: a.comentario ?? undefined,
      pros: a.pros,
      contras: a.contras,
      criadoEm: a.criadoEm,
      editadaEm: a.editadaEm ?? undefined,
      verificacao: a.statusVerificacao,
      avaliadorNome: avaliador.nome,
      avaliadorSlug: avaliador.slug,
      resposta: a.resposta
        ? {
            texto: a.resposta.texto,
            autorNome: perfilNome,
            criadoEm: a.resposta.criadoEm,
            editadaEm: a.resposta.atualizadoEm !== a.resposta.criadoEm ? a.resposta.atualizadoEm : undefined,
          }
        : undefined,
    };
  });
  return { itens, pagina, totalPaginas: Math.ceil(total / TAMANHO_PAGINA_AVALIACOES) };
}

export async function obterEstadoInteracao(
  perfil: { id: string } & PerfilParaPosse,
  empresaId: string | null,
): Promise<EstadoInteracao> {
  if (!empresaId) return { logado: false, proprio: false, criador: false, jaAvaliou: false, jaRecomendou: false };
  const [empresa, avaliacao, indicacao] = await Promise.all([
    prisma.empresa.findUniqueOrThrow({ where: { id: empresaId }, select: { id: true, documento: true } }),
    prisma.avaliacao.findUnique({
      where: { avaliadorEmpresaId_perfilId: { avaliadorEmpresaId: empresaId, perfilId: perfil.id } },
      select: { id: true },
    }),
    prisma.indicacao.findUnique({
      where: { indicadoPorEmpresaId_perfilId: { indicadoPorEmpresaId: empresaId, perfilId: perfil.id } },
      select: { id: true },
    }),
  ]);
  return {
    logado: true,
    proprio: ehProprio(perfil, empresa),
    criador: criouPerfil(perfil, empresaId),
    jaAvaliou: !!avaliacao,
    jaRecomendou: !!indicacao,
  };
}

/**
 * Notificação para uma empresa. Sempre dentro da transação do evento que a
 * causou. Não repete a mesma notificação (mesmo tipo e texto) dentro de 24 h:
 * evita que alguém inunde a vítima apagando e refazendo uma recomendação.
 */
export async function criarNotificacao(
  tx: Prisma.TransactionClient,
  empresaId: string,
  tipo: string,
  texto: string,
  href: string,
  opcoes?: { semDedupe?: boolean },
): Promise<void> {
  if (!opcoes?.semDedupe) {
    const desde = new Date(Date.now() - UM_DIA_MS).toISOString();
    const repetida = await tx.notificacao.findFirst({
      where: { empresaId, tipo, texto, criadoEm: { gte: desde } },
      select: { id: true },
    });
    if (repetida) return;
  }
  await tx.notificacao.create({
    data: { empresaId, tipo, texto, href, criadoEm: new Date().toISOString() },
  });
}

/**
 * Registra a recomendação (uma por par) respeitando o limite diário. Usado
 * por "Recomendar" e pela indicação que reaproveita um perfil existente, para
 * que as duas vias compartilhem o mesmo teto. Idempotente.
 */
export async function registrarRecomendacao(
  empresaId: string,
  perfil: { id: string; empresaId: string | null },
  textoNotificacao: string,
): Promise<void> {
  const limite = await verificarLimite(`rede-recomendar:${empresaId}`, RECOMENDACOES_POR_DIA, UM_DIA_MS);
  if (!limite.permitido) throw new ErroDeNegocio("Você fez muitas recomendações hoje. Tente de novo amanhã.");

  const existente = await prisma.indicacao.findUnique({
    where: { indicadoPorEmpresaId_perfilId: { indicadoPorEmpresaId: empresaId, perfilId: perfil.id } },
    select: { id: true },
  });
  if (existente) return;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.indicacao.create({
        data: { perfilId: perfil.id, indicadoPorEmpresaId: empresaId, criadoEm: new Date().toISOString() },
      });
      if (perfil.empresaId) {
        await criarNotificacao(tx, perfil.empresaId, "recomendacao_recebida", textoNotificacao, "/minha-rede/perfil");
      }
    });
  } catch (erro) {
    // Duplo clique ou outra aba criaram a mesma recomendação: continua idempotente.
    if (!(typeof erro === "object" && erro !== null && "code" in erro && erro.code === "P2002")) throw erro;
  }
}
