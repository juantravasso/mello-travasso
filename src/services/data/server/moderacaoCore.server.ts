import "server-only";
import type { Prisma } from "@prisma/client";
import type { AcaoModeracaoAvaliacao, DecisaoDenuncia, StatusAvaliacao } from "@/types";
import { registrarLogAdmin } from "./adminLog.server";
import { CANAL_CONTESTACAO, criarNotificacao } from "./avaliacaoCore.server";
import { ErroDeNegocio } from "./resultado.server";

// Operações de moderação compartilhadas entre as telas de avaliações/perfis
// do admin e a decisão de uma denúncia. Sempre dentro da transação de quem
// chama, para a mudança, o log e a notificação serem uma coisa só.

// De quais status cada ação pode partir, e para qual chega.
const TRANSICOES: Record<AcaoModeracaoAvaliacao, { de: StatusAvaliacao[]; para: StatusAvaliacao }> = {
  ocultar: { de: ["publicada"], para: "oculta" },
  remover: { de: ["publicada", "oculta"], para: "removida" },
  restaurar: { de: ["oculta", "removida"], para: "publicada" },
};

const CONTESTAR = `Se discordar, escreva para ${CANAL_CONTESTACAO}.`;

const TEXTO_NOTIFICACAO: Record<AcaoModeracaoAvaliacao, (perfil: string) => string> = {
  ocultar: (perfil) => `Sua avaliação sobre ${perfil} foi ocultada pela moderação por não seguir as regras da rede. ${CONTESTAR}`,
  remover: (perfil) => `Sua avaliação sobre ${perfil} foi removida pela moderação por não seguir as regras da rede. ${CONTESTAR}`,
  restaurar: (perfil) => `Sua avaliação sobre ${perfil} voltou a ser exibida.`,
};

const ABERTAS = ["aberta", "em_analise", "aguardando_informacoes"] as const;

/**
 * Quando o conteúdo denunciado sai do ar por outro caminho (tela de avaliações,
 * tela de perfis ou a decisão de outra denúncia), as demais denúncias abertas
 * sobre o mesmo alvo ficam sem objeto: encerra todas na mesma transação e avisa
 * os denunciantes. `exceto` é a denúncia que está sendo decidida agora.
 */
async function encerrarDenunciasDoAlvo(
  tx: Prisma.TransactionClient,
  alvo: { avaliacaoId: string } | { perfilId: string },
  decisao: DecisaoDenuncia,
  exceto?: string,
): Promise<void> {
  const abertas = await tx.denuncia.findMany({
    where: { ...alvo, status: { in: [...ABERTAS] }, ...(exceto ? { id: { not: exceto } } : {}) },
    select: { id: true, denuncianteEmpresaId: true },
  });
  if (abertas.length === 0) return;
  const agora = new Date().toISOString();
  const mensagem = "A moderação tirou do ar o conteúdo que você denunciou.";
  await tx.denuncia.updateMany({
    where: { id: { in: abertas.map((d) => d.id) }, status: { in: [...ABERTAS] } },
    data: { status: "resolvida", decisao, mensagemAoDenunciante: mensagem, resolvidaEm: agora, atualizadoEm: agora },
  });
  for (const d of abertas) {
    await criarNotificacao(tx, d.denuncianteEmpresaId, "denuncia_analisada", `Sua denúncia foi analisada: ${mensagem}`, "/minha-rede/denuncias", {
      semDedupe: true,
    });
  }
}

/** Oculta, remove ou restaura uma avaliação. Registra no log, avisa o avaliador e encerra denúncias que perderam o objeto. */
export async function aplicarModeracaoAvaliacao(
  tx: Prisma.TransactionClient,
  adminUsuarioId: string,
  avaliacaoId: string,
  acao: AcaoModeracaoAvaliacao,
  motivo: string,
  extra?: Prisma.InputJsonObject,
  denunciaAtualId?: string,
): Promise<void> {
  const { de, para } = TRANSICOES[acao];
  const avaliacao = await tx.avaliacao.findUnique({
    where: { id: avaliacaoId },
    select: { id: true, status: true, avaliadorEmpresaId: true, perfil: { select: { nome: true } } },
  });
  if (!avaliacao) throw new ErroDeNegocio("Avaliação não encontrada.");

  const atualizados = await tx.avaliacao.updateMany({
    where: { id: avaliacao.id, status: { in: de } },
    data: { status: para, atualizadoEm: new Date().toISOString() },
  });
  if (atualizados.count === 0) throw new ErroDeNegocio("Esta avaliação não está num estado que permita essa ação.");

  await registrarLogAdmin(tx, adminUsuarioId, `avaliacao.${acao}`, "Avaliacao", avaliacao.id, {
    statusAnterior: avaliacao.status,
    statusNovo: para,
    motivo,
    ...extra,
  });
  await criarNotificacao(
    tx,
    avaliacao.avaliadorEmpresaId,
    "avaliacao_moderada",
    TEXTO_NOTIFICACAO[acao](avaliacao.perfil.nome),
    "/minha-rede/avaliacoes?aba=feitas",
    { semDedupe: true },
  );
  if (acao !== "restaurar") {
    await encerrarDenunciasDoAlvo(
      tx,
      { avaliacaoId: avaliacao.id },
      acao === "ocultar" ? "avaliacao_ocultada" : "avaliacao_removida",
      denunciaAtualId,
    );
  }
}

/** Suspende um perfil (some da rede; o dono não consegue republicar). Registra no log, avisa o dono e encerra denúncias abertas. */
export async function aplicarSuspensaoPerfil(
  tx: Prisma.TransactionClient,
  adminUsuarioId: string,
  perfilId: string,
  motivo: string,
  extra?: Prisma.InputJsonObject,
  denunciaAtualId?: string,
): Promise<void> {
  const perfil = await tx.perfilPublico.findUnique({
    where: { id: perfilId },
    select: { id: true, slug: true, status: true, empresaId: true },
  });
  if (!perfil) throw new ErroDeNegocio("Perfil não encontrado.");
  const atualizados = await tx.perfilPublico.updateMany({
    where: { id: perfil.id, status: { not: "suspenso" } },
    data: { status: "suspenso", atualizadoEm: new Date().toISOString() },
  });
  if (atualizados.count === 0) throw new ErroDeNegocio("Este perfil já está suspenso.");
  await registrarLogAdmin(tx, adminUsuarioId, "perfil.suspender", "PerfilPublico", perfil.id, {
    slug: perfil.slug,
    statusAnterior: perfil.status,
    motivo,
    ...extra,
  });
  if (perfil.empresaId) {
    await criarNotificacao(
      tx,
      perfil.empresaId,
      "perfil_suspenso",
      `Seu perfil na rede foi suspenso pela moderação por não seguir as regras. ${CONTESTAR}`,
      "/minha-rede/perfil",
      { semDedupe: true },
    );
  }
  await encerrarDenunciasDoAlvo(tx, { perfilId: perfil.id }, "perfil_suspenso", denunciaAtualId);
}
