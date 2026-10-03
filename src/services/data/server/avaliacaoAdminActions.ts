"use server";

import { prisma } from "@/lib/prisma";
import { exigirAdminAction } from "@/lib/auth/dal";
import { moderarAvaliacaoSchema } from "@/lib/validacao/rede";
import { normalizarBusca } from "@/lib/rede/texto";
import type { AcaoModeracaoAvaliacao, AvaliacaoAdminItem, ResultadoAction, StatusAvaliacao } from "@/types";
import { nomePublicoDaEmpresa, selecaoEmpresaParaNome } from "./avaliacaoCore.server";
import { aplicarModeracaoAvaliacao } from "./moderacaoCore.server";
import { exigirSenhaDoAdmin } from "./reautenticacao.server";
import { ErroDeNegocio, executar } from "./resultado.server";

const STATUS_VALIDOS: readonly StatusAvaliacao[] = ["publicada", "oculta", "removida"];

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
 * avaliação oculta ou removida sai das médias e da página pública. Toda ação
 * pede a senha do admin: restaurar republica conteúdo que pode ter sido derrubado
 * por ser ofensivo ou fraudulento.
 */
export async function moderarAvaliacao(
  avaliacaoId: string,
  acao: AcaoModeracaoAvaliacao,
  motivo: string,
  senha?: string,
): Promise<ResultadoAction<null>> {
  const admin = await exigirAdminAction();
  return executar(async () => {
    const parsed = moderarAvaliacaoSchema.safeParse({ avaliacaoId, acao, motivo });
    if (!parsed.success) throw new ErroDeNegocio(parsed.error.issues[0]?.message ?? "Dados inválidos.");
    await exigirSenhaDoAdmin(admin.usuarioId, senha);

    await prisma.$transaction((tx) =>
      aplicarModeracaoAvaliacao(tx, admin.usuarioId, parsed.data.avaliacaoId, parsed.data.acao, parsed.data.motivo),
    );
    return null;
  });
}
