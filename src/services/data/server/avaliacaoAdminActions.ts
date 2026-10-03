"use server";

import { prisma } from "@/lib/prisma";
import { exigirAdminAction } from "@/lib/auth/dal";
import { moderarAvaliacaoSchema } from "@/lib/validacao/rede";
import { normalizarBusca } from "@/lib/rede/texto";
import type { AcaoModeracaoAvaliacao, AvaliacaoAdminItem, ResultadoAction, StatusAvaliacao } from "@/types";
import { registrarLogAdmin } from "./adminLog.server";
import { criarNotificacao, nomePublicoDaEmpresa, selecaoEmpresaParaNome } from "./avaliacaoCore.server";
import { ErroDeNegocio, executar } from "./resultado.server";

const STATUS_VALIDOS: readonly StatusAvaliacao[] = ["publicada", "oculta", "removida"];

// De quais status cada ação pode partir, e para qual chega.
const TRANSICOES: Record<AcaoModeracaoAvaliacao, { de: StatusAvaliacao[]; para: StatusAvaliacao }> = {
  ocultar: { de: ["publicada"], para: "oculta" },
  remover: { de: ["publicada", "oculta"], para: "removida" },
  restaurar: { de: ["oculta", "removida"], para: "publicada" },
};

const TEXTO_NOTIFICACAO: Record<AcaoModeracaoAvaliacao, (perfil: string) => string> = {
  ocultar: (perfil) => `Sua avaliação sobre ${perfil} foi ocultada pela moderação.`,
  remover: (perfil) => `Sua avaliação sobre ${perfil} foi removida pela moderação.`,
  restaurar: (perfil) => `Sua avaliação sobre ${perfil} voltou a ser exibida.`,
};

/** Avaliações para a moderação, com filtro de status e busca pelo nome do perfil avaliado. */
export async function listarAvaliacoesAdmin(busca?: string, status?: string): Promise<AvaliacaoAdminItem[]> {
  await exigirAdminAction();
  const termo = typeof busca === "string" ? normalizarBusca(busca).replace(/[%_\\]/g, " ").trim().slice(0, 80) : "";
  const statusFiltro = STATUS_VALIDOS.find((s) => s === status);
  const registros = await prisma.avaliacao.findMany({
    where: {
      ...(statusFiltro ? { status: statusFiltro } : {}),
      ...(termo ? { perfil: { nomeBusca: { contains: termo } } } : {}),
    },
    include: { perfil: { select: { slug: true, nome: true } }, avaliador: { select: selecaoEmpresaParaNome } },
    orderBy: [{ criadoEm: "desc" }, { id: "asc" }],
    take: 50,
  });
  return registros.map((a) => ({
    id: a.id,
    status: a.status,
    nota: a.nota,
    comentario: a.comentario ?? undefined,
    criadoEm: a.criadoEm,
    perfilSlug: a.perfil.slug,
    perfilNome: a.perfil.nome,
    avaliadorNome: nomePublicoDaEmpresa(a.avaliador).nome,
  }));
}

/**
 * Oculta, remove ou restaura uma avaliação. Nunca é automático: só a
 * administração, com motivo registrado no log, e o avaliador é avisado. Uma
 * avaliação oculta ou removida sai das médias e da página pública.
 */
export async function moderarAvaliacao(
  avaliacaoId: string,
  acao: AcaoModeracaoAvaliacao,
  motivo: string,
): Promise<ResultadoAction<null>> {
  const admin = await exigirAdminAction();
  return executar(async () => {
    const parsed = moderarAvaliacaoSchema.safeParse({ avaliacaoId, acao, motivo });
    if (!parsed.success) throw new ErroDeNegocio(parsed.error.issues[0]?.message ?? "Dados inválidos.");
    const { de, para } = TRANSICOES[parsed.data.acao];

    await prisma.$transaction(async (tx) => {
      const avaliacao = await tx.avaliacao.findUnique({
        where: { id: parsed.data.avaliacaoId },
        select: { id: true, status: true, avaliadorEmpresaId: true, perfil: { select: { nome: true } } },
      });
      if (!avaliacao) throw new ErroDeNegocio("Avaliação não encontrada.");

      const atualizados = await tx.avaliacao.updateMany({
        where: { id: avaliacao.id, status: { in: de } },
        data: { status: para, atualizadoEm: new Date().toISOString() },
      });
      if (atualizados.count === 0) throw new ErroDeNegocio("Esta avaliação não está num estado que permita essa ação.");

      await registrarLogAdmin(tx, admin.usuarioId, `avaliacao.${parsed.data.acao}`, "Avaliacao", avaliacao.id, {
        statusAnterior: avaliacao.status,
        statusNovo: para,
        motivo: parsed.data.motivo,
      });
      await criarNotificacao(
        tx,
        avaliacao.avaliadorEmpresaId,
        "avaliacao_moderada",
        TEXTO_NOTIFICACAO[parsed.data.acao](avaliacao.perfil.nome),
        "/minha-rede/avaliacoes?aba=feitas",
      );
    });
    return null;
  });
}
