"use server";

import { Prisma } from "@prisma/client";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { exigirRedeAction } from "@/lib/auth/dal";
import { extrairIpConfiavel, verificarLimite } from "@/lib/auth/limite";
import { responderAvaliacaoSchema, responderRelacaoSchema, salvarAvaliacaoSchema, slugSchema } from "@/lib/validacao/rede";
import type {
  AvaliacaoFeita,
  AvaliacaoParaEditar,
  AvaliacaoRecebida,
  ResultadoAction,
  SalvarAvaliacaoInput,
} from "@/types";
import {
  criarNotificacao,
  criouPerfil,
  IDADE_MINIMA_CONTA_MS,
  ehProprio,
  nomePublicoDaEmpresa,
  registrarRecomendacao,
  selecaoEmpresaParaNome,
  STATUS_VISIVEIS,
} from "./avaliacaoCore.server";
import { exigirEmailConfirmado } from "./emailConfirmado.server";
import { ErroDeNegocio, executar } from "./resultado.server";

const AVALIACOES_POR_DIA = 20;
const AVALIACOES_POR_IP_POR_DIA = 30;
const EDICOES_POR_DIA = 20;
const AVALIACOES_POR_PERFIL_POR_DIA = 15;
const UM_DIA_MS = 24 * 60 * 60 * 1000;

function ehConflito(erro: unknown): boolean {
  return erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002";
}

function textoEstrelas(nota: number): string {
  return `${nota} ${nota === 1 ? "estrela" : "estrelas"}`;
}

const selecaoPerfil = {
  id: true,
  nome: true,
  slug: true,
  empresaId: true,
  documentoIndicado: true,
  indicadoPorEmpresaId: true,
} as const;

async function buscarPerfilVisivel(slug: unknown) {
  const parsed = slugSchema.safeParse(slug);
  if (!parsed.success) throw new ErroDeNegocio("Perfil não encontrado.");
  const perfil = await prisma.perfilPublico.findFirst({
    where: { slug: parsed.data, status: { in: [...STATUS_VISIVEIS] } },
    select: selecaoPerfil,
  });
  if (!perfil) throw new ErroDeNegocio("Perfil não encontrado.");
  return perfil;
}

function exigirPodeAvaliar(
  perfil: Awaited<ReturnType<typeof buscarPerfilVisivel>>,
  empresa: { id: string; documento: string },
): void {
  if (ehProprio(perfil, empresa)) throw new ErroDeNegocio("Você não pode avaliar o próprio perfil.");
  if (criouPerfil(perfil, empresa.id)) {
    throw new ErroDeNegocio("Você criou este perfil por indicação, então não pode avaliá-lo. Você pode recomendá-lo.");
  }
}

export async function obterAvaliacaoParaEditar(slug: string): Promise<ResultadoAction<AvaliacaoParaEditar>> {
  const sessao = await exigirRedeAction();
  return executar(async () => {
    const perfil = await buscarPerfilVisivel(slug);
    const empresa = await prisma.empresa.findUniqueOrThrow({
      where: { id: sessao.empresaId },
      select: { id: true, documento: true },
    });
    exigirPodeAvaliar(perfil, empresa);
    const existente = await prisma.avaliacao.findUnique({
      where: { avaliadorEmpresaId_perfilId: { avaliadorEmpresaId: sessao.empresaId, perfilId: perfil.id } },
    });
    return {
      perfil: { slug: perfil.slug, nome: perfil.nome },
      avaliacao: existente
        ? {
            nota: existente.nota,
            comentario: existente.comentario ?? undefined,
            pros: existente.pros,
            contras: existente.contras,
          }
        : null,
    };
  });
}

/** Cria a avaliação da empresa da sessão para o perfil, ou edita a que já existe (uma por par). */
export async function salvarAvaliacao(input: SalvarAvaliacaoInput): Promise<ResultadoAction<null>> {
  const sessao = await exigirRedeAction();
  return executar(async () => {
    exigirEmailConfirmado(sessao, "avaliar");
    const parsed = salvarAvaliacaoSchema.safeParse(input);
    if (!parsed.success) throw new ErroDeNegocio(parsed.error.issues[0]?.message ?? "Dados inválidos.");
    const dados = parsed.data;

    const perfil = await buscarPerfilVisivel(dados.perfilSlug);
    const empresa = await prisma.empresa.findUniqueOrThrow({
      where: { id: sessao.empresaId },
      select: { id: true, documento: true, criadoEm: true },
    });
    exigirPodeAvaliar(perfil, empresa);

    const agora = new Date().toISOString();
    const existente = await prisma.avaliacao.findUnique({
      where: { avaliadorEmpresaId_perfilId: { avaliadorEmpresaId: sessao.empresaId, perfilId: perfil.id } },
    });

    if (existente) {
      if (existente.status !== "publicada") throw new ErroDeNegocio("Esta avaliação não pode ser editada.");
      const limiteEdicao = await verificarLimite(`rede-avaliar-edicao:${sessao.empresaId}`, EDICOES_POR_DIA, UM_DIA_MS);
      if (!limiteEdicao.permitido) throw new ErroDeNegocio("Muitas edições hoje. Tente de novo amanhã.");
      try {
        await prisma.$transaction(async (tx) => {
          // Snapshot da versão que está sendo substituída (auditoria). O unique
          // (avaliacaoId, versao) e o where por versao impedem duas edições
          // concorrentes de passarem juntas.
          await tx.avaliacaoHistorico.create({
            data: {
              avaliacaoId: existente.id,
              versao: existente.versao,
              nota: existente.nota,
              comentario: existente.comentario,
              pros: existente.pros,
              contras: existente.contras,
              registradoPorUsuarioId: sessao.usuarioId,
              registradoEm: agora,
            },
          });
          const atualizados = await tx.avaliacao.updateMany({
            where: { id: existente.id, versao: existente.versao, status: "publicada" },
            data: {
              nota: dados.nota,
              comentario: dados.comentario ?? null,
              pros: dados.pros,
              contras: dados.contras,
              versao: existente.versao + 1,
              editadaEm: agora,
              atualizadoEm: agora,
            },
          });
          if (atualizados.count === 0) throw new ErroDeNegocio("A avaliação mudou em outra aba. Recarregue a página.");
        });
      } catch (erro) {
        if (ehConflito(erro)) throw new ErroDeNegocio("A avaliação mudou em outra aba. Recarregue a página.");
        throw erro;
      }
      return null;
    }

    // Conta muito nova não avalia: contas de fachada criadas só para avaliar
    // (ou difamar) um concorrente esperam ao menos um dia.
    if (Date.now() - new Date(empresa.criadoEm).getTime() < IDADE_MINIMA_CONTA_MS) {
      throw new ErroDeNegocio("Sua conta precisa ter pelo menos 24 horas para publicar avaliações. Volte amanhã.");
    }
    const limite = await verificarLimite(`rede-avaliar:${sessao.empresaId}`, AVALIACOES_POR_DIA, UM_DIA_MS);
    if (!limite.permitido) throw new ErroDeNegocio("Você já enviou muitas avaliações hoje. Tente de novo amanhã.");
    const limiteIp = await verificarLimite(
      `rede-avaliar-ip:${extrairIpConfiavel(await headers())}`,
      AVALIACOES_POR_IP_POR_DIA,
      UM_DIA_MS,
    );
    if (!limiteIp.permitido) throw new ErroDeNegocio("Muitas avaliações a partir desta rede hoje. Tente de novo amanhã.");
    // Teto por perfil: acima dele a avaliação entra, mas não notifica o dono.
    // (Recusar daria a um atacante o poder de bloquear avaliações legítimas.)
    const limitePerfil = await verificarLimite(`rede-avaliar-perfil:${perfil.id}`, AVALIACOES_POR_PERFIL_POR_DIA, UM_DIA_MS);

    const avaliador = await prisma.empresa.findUniqueOrThrow({
      where: { id: sessao.empresaId },
      select: selecaoEmpresaParaNome,
    });
    try {
      await prisma.$transaction(async (tx) => {
        await tx.avaliacao.create({
          data: {
            perfilId: perfil.id,
            avaliadorEmpresaId: sessao.empresaId,
            avaliadorUsuarioId: sessao.usuarioId,
            nota: dados.nota,
            comentario: dados.comentario ?? null,
            pros: dados.pros,
            contras: dados.contras,
            criadoEm: agora,
            atualizadoEm: agora,
          },
        });
        if (perfil.empresaId && limitePerfil.permitido) {
          await criarNotificacao(
            tx,
            perfil.empresaId,
            "avaliacao_recebida",
            `${nomePublicoDaEmpresa(avaliador).nome} avaliou seu perfil com ${textoEstrelas(dados.nota)}.`,
            "/minha-rede/avaliacoes?aba=recebidas",
          );
        }
      });
    } catch (erro) {
      if (ehConflito(erro)) throw new ErroDeNegocio("Você já avaliou este perfil. Edite a avaliação existente.");
      throw erro;
    }
    return null;
  });
}

export async function listarAvaliacoesFeitas(): Promise<AvaliacaoFeita[]> {
  const sessao = await exigirRedeAction();
  const registros = await prisma.avaliacao.findMany({
    where: { avaliadorEmpresaId: sessao.empresaId },
    include: { perfil: { select: { slug: true, nome: true } }, resposta: true },
    orderBy: [{ criadoEm: "desc" }, { id: "asc" }],
    take: 200,
  });
  return registros.map((a) => ({
    id: a.id,
    status: a.status,
    perfilSlug: a.perfil.slug,
    perfilNome: a.perfil.nome,
    nota: a.nota,
    comentario: a.comentario ?? undefined,
    pros: a.pros,
    contras: a.contras,
    criadoEm: a.criadoEm,
    editadaEm: a.editadaEm ?? undefined,
    resposta: a.resposta
      ? {
          texto: a.resposta.texto,
          autorNome: a.perfil.nome,
          criadoEm: a.resposta.criadoEm,
          editadaEm: a.resposta.atualizadoEm !== a.resposta.criadoEm ? a.resposta.atualizadoEm : undefined,
        }
      : undefined,
  }));
}

export async function listarAvaliacoesRecebidas(): Promise<AvaliacaoRecebida[]> {
  const sessao = await exigirRedeAction();
  const perfil = await prisma.perfilPublico.findUnique({
    where: { empresaId: sessao.empresaId },
    select: { id: true },
  });
  if (!perfil) return [];
  const registros = await prisma.avaliacao.findMany({
    where: { perfilId: perfil.id, status: "publicada" },
    include: { avaliador: { select: selecaoEmpresaParaNome }, resposta: true, verificacaoRelacao: { select: { estado: true } } },
    orderBy: [{ criadoEm: "desc" }, { id: "asc" }],
    take: 200,
  });
  return registros.map((a) => ({
    id: a.id,
    nota: a.nota,
    comentario: a.comentario ?? undefined,
    pros: a.pros,
    contras: a.contras,
    criadoEm: a.criadoEm,
    editadaEm: a.editadaEm ?? undefined,
    avaliadorNome: nomePublicoDaEmpresa(a.avaliador).nome,
    relacao: a.verificacaoRelacao?.estado,
    resposta: a.resposta ? { texto: a.resposta.texto, criadoEm: a.resposta.criadoEm } : undefined,
  }));
}

/** Direito de resposta: só a empresa dona do perfil avaliado responde; uma resposta por avaliação, editável. */
export async function responderAvaliacao(avaliacaoId: string, texto: string): Promise<ResultadoAction<null>> {
  const sessao = await exigirRedeAction();
  return executar(async () => {
    exigirEmailConfirmado(sessao, "responder avaliações");
    const parsed = responderAvaliacaoSchema.safeParse({ avaliacaoId, texto });
    if (!parsed.success) throw new ErroDeNegocio(parsed.error.issues[0]?.message ?? "Dados inválidos.");

    const avaliacao = await prisma.avaliacao.findFirst({
      where: { id: parsed.data.avaliacaoId, status: "publicada", perfil: { empresaId: sessao.empresaId } },
      include: { perfil: { select: { nome: true, slug: true } }, resposta: { select: { id: true } } },
    });
    if (!avaliacao) throw new ErroDeNegocio("Avaliação não encontrada.");

    const agora = new Date().toISOString();
    await prisma.$transaction(async (tx) => {
      await tx.respostaAvaliacao.upsert({
        where: { avaliacaoId: avaliacao.id },
        create: {
          avaliacaoId: avaliacao.id,
          autorEmpresaId: sessao.empresaId,
          autorUsuarioId: sessao.usuarioId,
          texto: parsed.data.texto,
          criadoEm: agora,
          atualizadoEm: agora,
        },
        update: { texto: parsed.data.texto, autorUsuarioId: sessao.usuarioId, atualizadoEm: agora },
      });
      if (!avaliacao.resposta) {
        await criarNotificacao(
          tx,
          avaliacao.avaliadorEmpresaId,
          "resposta_recebida",
          `${avaliacao.perfil.nome} respondeu à sua avaliação.`,
          `/empresas/${avaliacao.perfil.slug}`,
        );
      }
    });
    return null;
  });
}

const RESPOSTAS_RELACAO_POR_DIA = 60;
const INTERVALO_MUDANCA_RELACAO_MS = 24 * 60 * 60 * 1000;

/**
 * O avaliado diz se trabalhou mesmo com quem o avaliou. "Confirmada" dá à
 * avaliação o selo "relação confirmada pelo avaliado"; "contestada" tira o selo
 * e fica registrada para a moderação (nunca oculta a avaliação por si). Só a
 * empresa dona do perfil avaliado responde, e pode mudar de ideia. O selo diz
 * quem atestou: é a palavra do avaliado, não uma checagem da plataforma.
 */
export async function responderRelacao(avaliacaoId: string, estado: "confirmada" | "contestada"): Promise<ResultadoAction<null>> {
  const sessao = await exigirRedeAction();
  return executar(async () => {
    exigirEmailConfirmado(sessao, "responder sobre a relação comercial");
    const parsed = responderRelacaoSchema.safeParse({ avaliacaoId, estado });
    if (!parsed.success) throw new ErroDeNegocio("Dados inválidos.");
    const limite = await verificarLimite(`rede-relacao:${sessao.empresaId}`, RESPOSTAS_RELACAO_POR_DIA, UM_DIA_MS);
    if (!limite.permitido) throw new ErroDeNegocio("Muitas respostas hoje. Tente de novo amanhã.");

    const avaliacao = await prisma.avaliacao.findFirst({
      where: { id: parsed.data.avaliacaoId, status: "publicada", perfil: { empresaId: sessao.empresaId } },
      select: {
        id: true,
        avaliadorEmpresaId: true,
        perfil: { select: { nome: true } },
        verificacaoRelacao: { select: { estado: true, respondidaEm: true } },
      },
    });
    if (!avaliacao || avaliacao.avaliadorEmpresaId === sessao.empresaId) throw new ErroDeNegocio("Avaliação não encontrada.");

    const anterior = avaliacao.verificacaoRelacao;
    if (anterior?.estado === parsed.data.estado) return null;
    // Mudar de ideia é permitido, mas não em rajada: cada virada fica na trilha e esta pausa barra o vai e volta.
    if (anterior && Date.now() - new Date(anterior.respondidaEm).getTime() < INTERVALO_MUDANCA_RELACAO_MS) {
      throw new ErroDeNegocio("Você respondeu há pouco. Para mudar a resposta, tente de novo em 24 horas.");
    }

    const agora = new Date().toISOString();
    const confirmou = parsed.data.estado === "confirmada";
    await prisma.$transaction(async (tx) => {
      await tx.verificacaoRelacaoHistorico.create({
        data: {
          avaliacaoId: avaliacao.id,
          estado: parsed.data.estado,
          metodo: "confirmacao_avaliado",
          usuarioId: sessao.usuarioId,
          registradoEm: agora,
        },
      });
      await tx.verificacaoRelacao.upsert({
        where: { avaliacaoId: avaliacao.id },
        create: {
          avaliacaoId: avaliacao.id,
          estado: parsed.data.estado,
          metodo: "confirmacao_avaliado",
          respondidaPorUsuarioId: sessao.usuarioId,
          respondidaEm: agora,
        },
        update: { estado: parsed.data.estado, respondidaPorUsuarioId: sessao.usuarioId, respondidaEm: agora },
      });
      // A comprovação por documento (6.5b) vale mais que a palavra do avaliado: a condição
      // vai no próprio UPDATE (atômica), então nunca é rebaixada, nem por corrida.
      await tx.avaliacao.updateMany({
        where: { id: avaliacao.id, statusVerificacao: { not: "relacao_comprovada" } },
        data: { statusVerificacao: confirmou ? "relacao_confirmada" : "nao_verificada" },
      });
      if (confirmou) {
        await criarNotificacao(
          tx,
          avaliacao.avaliadorEmpresaId,
          "relacao_confirmada",
          `${avaliacao.perfil.nome} confirmou que trabalhou com você. Sua avaliação ganhou o selo de relação confirmada.`,
          "/minha-rede/avaliacoes?aba=feitas",
        );
      }
    });
    return null;
  });
}

export async function recomendarPerfil(slug: string): Promise<ResultadoAction<null>> {
  const sessao = await exigirRedeAction();
  return executar(async () => {
    exigirEmailConfirmado(sessao, "recomendar");
    const perfil = await buscarPerfilVisivel(slug);
    const empresa = await prisma.empresa.findUniqueOrThrow({
      where: { id: sessao.empresaId },
      select: { id: true, documento: true, ...selecaoEmpresaParaNome },
    });
    if (ehProprio(perfil, empresa)) throw new ErroDeNegocio("Você não pode recomendar o próprio perfil.");
    await registrarRecomendacao(
      sessao.empresaId,
      perfil,
      `${nomePublicoDaEmpresa(empresa).nome} recomendou seu perfil.`,
    );
    return null;
  });
}

export async function removerRecomendacao(slug: string): Promise<ResultadoAction<null>> {
  const sessao = await exigirRedeAction();
  return executar(async () => {
    const parsed = slugSchema.safeParse(slug);
    if (!parsed.success) throw new ErroDeNegocio("Perfil não encontrado.");
    // Sem filtro de status: a empresa sempre consegue retirar a própria recomendação.
    await prisma.indicacao.deleteMany({
      where: { indicadoPorEmpresaId: sessao.empresaId, perfil: { slug: parsed.data } },
    });
    return null;
  });
}
