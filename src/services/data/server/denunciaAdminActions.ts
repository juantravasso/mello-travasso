"use server";

import { prisma } from "@/lib/prisma";
import { exigirAdminAction } from "@/lib/auth/dal";
import { decidirDenunciaSchema, solicitarInformacoesSchema } from "@/lib/validacao/rede";
import type { DenunciaAdminItem, DecisaoDenuncia, PaginaDenunciasAdmin, ResultadoAction, StatusDenuncia } from "@/types";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { registrarLogAdmin } from "./adminLog.server";
import { criarNotificacao, nomeParaAdmin, nomePublicoDaEmpresa, selecaoEmpresaParaNome } from "./avaliacaoCore.server";
import { aplicarModeracaoAvaliacao, aplicarSuspensaoPerfil } from "./moderacaoCore.server";
import { exigirSenhaDoAdmin } from "./reautenticacao.server";
import { ErroDeNegocio, executar } from "./resultado.server";

const STATUS_VALIDOS: readonly StatusDenuncia[] = ["aberta", "em_analise", "aguardando_informacoes", "resolvida", "rejeitada"];
const ABERTAS: StatusDenuncia[] = ["aberta", "em_analise", "aguardando_informacoes"];
const TAMANHO_PAGINA = 20;

const HREF_MINHAS_DENUNCIAS = "/minha-rede/denuncias";

/**
 * Fila de denúncias. Sem filtro (ou "pendentes"): só as abertas, das mais
 * antigas para as mais novas (ordem de fila: ninguém fica enterrado por um
 * lote novo). "todas": abertas primeiro, depois as encerradas. Um status
 * específico filtra por ele. Paginada, com a contagem de abertas.
 */
export async function listarDenunciasAdmin(filtro?: string, pagina?: number): Promise<PaginaDenunciasAdmin> {
  await exigirAdminAction();
  const numero = typeof pagina === "number" && Number.isInteger(pagina) && pagina >= 1 && pagina <= 2000 ? pagina : 1;
  const especifico = STATUS_VALIDOS.find((s) => s === filtro);
  const modo: "pendentes" | "todas" | "especifico" = especifico ? "especifico" : filtro === "todas" ? "todas" : "pendentes";

  const where: Prisma.DenunciaWhereInput =
    modo === "especifico" ? { status: especifico } : modo === "pendentes" ? { status: { in: ABERTAS } } : {};
  const abertas = await prisma.denuncia.count({ where: { status: { in: ABERTAS } } });
  const total = modo === "pendentes" ? abertas : await prisma.denuncia.count({ where });

  const incluir = {
    denunciante: { select: { id: true, razaoSocial: true, nomeFantasia: true, tipoPessoa: true } },
    avaliacao: {
      select: {
        id: true,
        nota: true,
        comentario: true,
        status: true,
        versao: true,
        perfil: { select: { nome: true, slug: true } },
        avaliador: { select: selecaoEmpresaParaNome },
      },
    },
    perfil: { select: { slug: true, nome: true, status: true } },
  } as const;

  // "todas": as abertas (mais antigas primeiro) antes das encerradas (mais recentes primeiro).
  let registros;
  if (modo === "todas") {
    const inicio = (numero - 1) * TAMANHO_PAGINA;
    const abertasNaPagina = await prisma.denuncia.findMany({
      where: { status: { in: ABERTAS } },
      include: incluir,
      orderBy: [{ criadoEm: "asc" }, { id: "asc" }],
      skip: Math.min(inicio, abertas),
      take: Math.max(0, Math.min(TAMANHO_PAGINA, abertas - inicio)),
    });
    const faltam = TAMANHO_PAGINA - abertasNaPagina.length;
    const encerradas =
      faltam > 0
        ? await prisma.denuncia.findMany({
            where: { status: { notIn: ABERTAS } },
            include: incluir,
            orderBy: [{ criadoEm: "desc" }, { id: "asc" }],
            skip: Math.max(0, inicio - abertas),
            take: faltam,
          })
        : [];
    registros = [...abertasNaPagina, ...encerradas];
  } else {
    registros = await prisma.denuncia.findMany({
      where,
      include: incluir,
      orderBy: [{ criadoEm: modo === "pendentes" ? "asc" : "desc" }, { id: "asc" }],
      skip: (numero - 1) * TAMANHO_PAGINA,
      take: TAMANHO_PAGINA,
    });
  }

  const adminIds = [...new Set(registros.map((d) => d.adminResponsavelId).filter((id): id is string => !!id))];
  const admins = adminIds.length
    ? await prisma.usuario.findMany({ where: { id: { in: adminIds } }, select: { id: true, nome: true } })
    : [];
  const nomeDoAdmin = new Map(admins.map((a) => [a.id, a.nome]));

  const itens: DenunciaAdminItem[] = registros.map((d) => ({
    id: d.id,
    alvoTipo: d.avaliacaoId ? "avaliacao" : "perfil",
    motivo: d.motivo,
    status: d.status,
    descricao: d.descricao,
    complemento: d.complemento ?? undefined,
    criadoEm: d.criadoEm,
    // A administração identifica o denunciante, mas sem CPF de MEI nem nome civil de autônomo.
    denuncianteNome: nomeParaAdmin(d.denunciante),
    adminResponsavelNome: d.adminResponsavelId ? nomeDoAdmin.get(d.adminResponsavelId) : undefined,
    decisao: d.decisao ?? undefined,
    observacaoAdmin: d.observacaoAdmin ?? undefined,
    mensagemAoDenunciante: d.mensagemAoDenunciante ?? undefined,
    avaliacao: d.avaliacao
      ? {
          id: d.avaliacao.id,
          nota: d.avaliacao.nota,
          comentario: d.avaliacao.comentario ?? undefined,
          status: d.avaliacao.status,
          versao: d.avaliacao.versao,
          perfilNome: d.avaliacao.perfil.nome,
          perfilSlug: d.avaliacao.perfil.slug,
          avaliadorNome: nomePublicoDaEmpresa(d.avaliacao.avaliador).nome,
        }
      : undefined,
    perfil: d.perfil ? { slug: d.perfil.slug, nome: d.perfil.nome, status: d.perfil.status } : undefined,
  }));

  return { itens, pagina: numero, totalPaginas: Math.max(1, Math.ceil(total / TAMANHO_PAGINA)), abertas };
}

async function rotuloDoAlvo(tx: Prisma.TransactionClient, d: { avaliacaoId: string | null; perfilId: string | null }) {
  if (d.avaliacaoId) {
    const a = await tx.avaliacao.findUnique({ where: { id: d.avaliacaoId }, select: { perfil: { select: { nome: true } } } });
    return `a avaliação sobre ${a?.perfil.nome ?? "o perfil"}`;
  }
  const p = d.perfilId ? await tx.perfilPublico.findUnique({ where: { id: d.perfilId }, select: { nome: true } }) : null;
  return `o perfil ${p?.nome ?? ""}`.trim();
}

/** A administração assume a denúncia: sai de "aberta" para "em análise" com um responsável. */
export async function assumirDenuncia(denunciaId: string): Promise<ResultadoAction<null>> {
  const admin = await exigirAdminAction();
  return executar(async () => {
    const id = z.string().uuid().safeParse(denunciaId);
    if (!id.success) throw new ErroDeNegocio("Denúncia não encontrada.");
    await prisma.$transaction(async (tx) => {
      const atualizados = await tx.denuncia.updateMany({
        where: { id: id.data, status: "aberta" },
        data: { status: "em_analise", adminResponsavelId: admin.usuarioId, atualizadoEm: new Date().toISOString() },
      });
      if (atualizados.count === 0) throw new ErroDeNegocio("Esta denúncia já foi assumida ou encerrada.");
      await registrarLogAdmin(tx, admin.usuarioId, "denuncia.assumir", "Denuncia", id.data, {});
    });
    return null;
  });
}

/** Pede ao denunciante mais informações; ele responde em "Minhas denúncias". */
export async function solicitarInformacoes(denunciaId: string, mensagem: string): Promise<ResultadoAction<null>> {
  const admin = await exigirAdminAction();
  return executar(async () => {
    const parsed = solicitarInformacoesSchema.safeParse({ denunciaId, mensagem });
    if (!parsed.success) throw new ErroDeNegocio(parsed.error.issues[0]?.message ?? "Dados inválidos.");

    await prisma.$transaction(async (tx) => {
      const denuncia = await tx.denuncia.findUnique({ where: { id: parsed.data.denunciaId } });
      if (!denuncia) throw new ErroDeNegocio("Denúncia não encontrada.");
      const atualizados = await tx.denuncia.updateMany({
        where: { id: denuncia.id, status: { in: ["aberta", "em_analise"] } },
        data: {
          status: "aguardando_informacoes",
          mensagemAoDenunciante: parsed.data.mensagem,
          adminResponsavelId: denuncia.adminResponsavelId ?? admin.usuarioId,
          atualizadoEm: new Date().toISOString(),
        },
      });
      if (atualizados.count === 0) throw new ErroDeNegocio("Esta denúncia não pode receber esse pedido agora.");
      await registrarLogAdmin(tx, admin.usuarioId, "denuncia.solicitar_informacoes", "Denuncia", denuncia.id, {
        mensagem: parsed.data.mensagem,
      });
      await criarNotificacao(
        tx,
        denuncia.denuncianteEmpresaId,
        "denuncia_informacoes",
        `A moderação pediu mais informações sobre a sua denúncia de ${await rotuloDoAlvo(tx, denuncia)}.`,
        HREF_MINHAS_DENUNCIAS,
        { semDedupe: true },
      );
    });
    return null;
  });
}

const DECISAO_POR_ACAO = {
  manter: "mantida",
  ocultar_avaliacao: "avaliacao_ocultada",
  remover_avaliacao: "avaliacao_removida",
  suspender_perfil: "perfil_suspenso",
} as const satisfies Record<string, DecisaoDenuncia>;

/**
 * Encerra a denúncia. "Manter" rejeita a denúncia e não toca no conteúdo; as
 * demais ações aplicam a moderação e resolvem. Ações que tiram conteúdo do ar
 * pedem a senha do admin. A decisão, a mensagem ao denunciante e a observação
 * interna ficam registradas, e o denunciante é avisado do resultado.
 * `versaoVista` é a versão da avaliação que o admin leu: se o autor a editou
 * depois, a decisão não é aplicada ao texto novo sem uma nova leitura.
 */
export async function decidirDenuncia(
  denunciaId: string,
  acao: "manter" | "ocultar_avaliacao" | "remover_avaliacao" | "suspender_perfil",
  mensagem: string,
  observacao?: string,
  senha?: string,
  versaoVista?: number,
): Promise<ResultadoAction<null>> {
  const admin = await exigirAdminAction();
  return executar(async () => {
    const parsed = decidirDenunciaSchema.safeParse({ denunciaId, acao, mensagem, observacao });
    if (!parsed.success) throw new ErroDeNegocio(parsed.error.issues[0]?.message ?? "Dados inválidos.");
    const dados = parsed.data;
    if (dados.acao !== "manter") await exigirSenhaDoAdmin(admin.usuarioId, senha);

    await prisma.$transaction(async (tx) => {
      const denuncia = await tx.denuncia.findUnique({ where: { id: dados.denunciaId } });
      if (!denuncia) throw new ErroDeNegocio("Denúncia não encontrada.");
      if (!ABERTAS.includes(denuncia.status)) throw new ErroDeNegocio("Esta denúncia já foi encerrada.");

      const rotulo = await rotuloDoAlvo(tx, denuncia);
      const extra = { denunciaId: denuncia.id } satisfies Prisma.InputJsonObject;

      if (dados.acao === "ocultar_avaliacao" || dados.acao === "remover_avaliacao") {
        if (!denuncia.avaliacaoId) throw new ErroDeNegocio("Esta denúncia não é sobre uma avaliação.");
        if (typeof versaoVista === "number") {
          const atual = await tx.avaliacao.findUnique({ where: { id: denuncia.avaliacaoId }, select: { versao: true } });
          if (atual && atual.versao !== versaoVista) {
            throw new ErroDeNegocio("O autor editou a avaliação depois que você a leu. Atualize a fila e reavalie o texto novo.");
          }
        }
        await aplicarModeracaoAvaliacao(
          tx,
          admin.usuarioId,
          denuncia.avaliacaoId,
          dados.acao === "ocultar_avaliacao" ? "ocultar" : "remover",
          dados.mensagem,
          extra,
          denuncia.id,
        );
      } else if (dados.acao === "suspender_perfil") {
        if (!denuncia.perfilId) throw new ErroDeNegocio("Esta denúncia não é sobre um perfil.");
        await aplicarSuspensaoPerfil(tx, admin.usuarioId, denuncia.perfilId, dados.mensagem, extra, denuncia.id);
      }

      const rejeitada = dados.acao === "manter";
      const agora = new Date().toISOString();
      const atualizados = await tx.denuncia.updateMany({
        where: { id: denuncia.id, status: { in: ABERTAS } },
        data: {
          status: rejeitada ? "rejeitada" : "resolvida",
          decisao: DECISAO_POR_ACAO[dados.acao],
          adminResponsavelId: denuncia.adminResponsavelId ?? admin.usuarioId,
          observacaoAdmin: dados.observacao ?? null,
          mensagemAoDenunciante: dados.mensagem,
          resolvidaEm: agora,
          atualizadoEm: agora,
        },
      });
      if (atualizados.count === 0) throw new ErroDeNegocio("Esta denúncia já foi encerrada.");

      await registrarLogAdmin(tx, admin.usuarioId, "denuncia.decidir", "Denuncia", denuncia.id, {
        acao: dados.acao,
        decisao: DECISAO_POR_ACAO[dados.acao],
        observacao: dados.observacao ?? null,
      });
      await criarNotificacao(
        tx,
        denuncia.denuncianteEmpresaId,
        "denuncia_analisada",
        rejeitada
          ? `Sua denúncia sobre ${rotulo} foi analisada e o conteúdo foi mantido.`
          : `Sua denúncia sobre ${rotulo} foi analisada e uma providência foi tomada.`,
        HREF_MINHAS_DENUNCIAS,
        { semDedupe: true },
      );
    });
    return null;
  });
}
