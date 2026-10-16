"use server";

import { prisma } from "@/lib/prisma";
import { exigirAdminAction } from "@/lib/auth/dal";
import { consultarReceita, type DadosReceita } from "@/lib/receita.server";
import { normalizarBusca } from "@/lib/rede/texto";
import { decidirSolicitacaoSchema, desfazerSolicitacaoSchema } from "@/lib/validacao/admin";
import type { ResultadoAction, SolicitacaoAdminItem } from "@/types";
import { registrarLogAdmin } from "./adminLog.server";
import { criarNotificacao, nomeParaAdmin } from "./avaliacaoCore.server";
import { exigirSenhaDoAdmin } from "./reautenticacao.server";
import { ErroDeNegocio, executar } from "./resultado.server";
import {
  aplicarAprovacao,
  apagarDocumentos,
  desfazerEfeito,
  documentoParaAdmin,
  expirarPedidosAntigos,
  fecharPedidosConcorrentes,
  notificarDecisao,
  travarPedidoPendente,
} from "./verificacaoCore.server";

/** Quantos pedidos, no máximo, ganham a consulta à Receita por carregamento da fila (o serviço é externo). */
const MAX_CONSULTAS_RECEITA = 10;
const TAMANHO_PAGINA = 50;

/** Pedido pendente só aparece na fila quando já tem documento: o resto expira e não ocupa a análise. */
const PENDENTE_COM_DOCUMENTO = { status: "pendente", documentos: { some: { apagadoEm: null } } } as const;

/** Fila de pedidos: os pendentes (mais antigos primeiro) ou os já decididos (mais recentes primeiro). */
export async function listarSolicitacoesAdmin(filtro?: "pendentes" | "decididas"): Promise<SolicitacaoAdminItem[]> {
  await exigirAdminAction();
  await expirarPedidosAntigos().catch(() => undefined);
  const pendentes = filtro !== "decididas";
  const registros = await prisma.solicitacaoVerificacao.findMany({
    where: pendentes ? PENDENTE_COM_DOCUMENTO : { status: { not: "pendente" } },
    include: {
      solicitanteEmpresa: {
        select: {
          id: true,
          documento: true,
          tipoPessoa: true,
          nomeFantasia: true,
          razaoSocial: true,
          verificadaEm: true,
          criadoEm: true,
        },
      },
      perfil: { select: { id: true, nome: true, slug: true, tipo: true, documentoIndicado: true } },
      avaliacao: {
        select: { nota: true, comentario: true, perfil: { select: { nome: true, slug: true } }, verificacaoRelacao: { select: { estado: true } } },
      },
      documentos: { select: { id: true, mime: true, tamanho: true, apagadoEm: true }, orderBy: { criadoEm: "asc" } },
    },
    orderBy: pendentes ? [{ criadoEm: "asc" }, { id: "asc" }] : [{ decididaEm: "desc" }, { id: "asc" }],
    take: TAMANHO_PAGINA,
  });

  // E-mail de quem fez o pedido (o usuário que o enviou), não o primeiro da empresa.
  const usuarios = await prisma.usuario.findMany({
    where: { id: { in: registros.map((r) => r.solicitanteUsuarioId) } },
    select: { id: true, email: true },
  });
  const emailDe = new Map(usuarios.map((u) => [u.id, u.email]));

  // O que está em jogo em cada perfil reivindicado, e quantos outros pedidos disputam o mesmo perfil.
  const perfilIds = [...new Set(registros.map((r) => r.perfil?.id).filter((id): id is string => !!id))];
  const [avaliacoesPorPerfil, indicacoesPorPerfil, pendentesPorPerfil, avaliacoesDoSolicitante] = await Promise.all([
    perfilIds.length ? prisma.avaliacao.groupBy({ by: ["perfilId"], where: { perfilId: { in: perfilIds }, status: "publicada" }, _count: { _all: true } }) : [],
    perfilIds.length ? prisma.indicacao.groupBy({ by: ["perfilId"], where: { perfilId: { in: perfilIds } }, _count: { _all: true } }) : [],
    perfilIds.length ? prisma.solicitacaoVerificacao.groupBy({ by: ["perfilId"], where: { perfilId: { in: perfilIds }, status: "pendente" }, _count: { _all: true } }) : [],
    perfilIds.length
      ? prisma.avaliacao.findMany({
          where: { perfilId: { in: perfilIds }, status: "publicada", avaliadorEmpresaId: { in: registros.map((r) => r.solicitanteEmpresaId) } },
          select: { perfilId: true, avaliadorEmpresaId: true },
        })
      : [],
  ]);
  const contagem = (lista: { perfilId: string | null; _count: { _all: number } }[], id: string) => lista.find((l) => l.perfilId === id)?._count._all ?? 0;

  // Dado oficial da Receita (só empresas, só pedidos pendentes, e só os primeiros).
  const receitaPorPedido = new Map<string, DadosReceita | null>();
  if (pendentes) {
    const consultaveis = registros
      .filter((r) => r.tipo !== "relacao_comprovada" && r.solicitanteEmpresa.tipoPessoa === "pj")
      .slice(0, MAX_CONSULTAS_RECEITA);
    const respostas = await Promise.all(consultaveis.map((r) => consultarReceita(r.solicitanteEmpresa.documento)));
    consultaveis.forEach((r, i) => receitaPorPedido.set(r.id, respostas[i] ?? null));
  }

  return registros.map((r) => {
    const oficial = receitaPorPedido.get(r.id);
    return {
      id: r.id,
      tipo: r.tipo,
      status: r.status,
      criadoEm: r.criadoEm,
      decididaEm: r.decididaEm ?? undefined,
      motivoDecisao: r.motivoDecisao ?? undefined,
      observacao: r.observacao ?? undefined,
      solicitante: {
        nome: nomeParaAdmin(r.solicitanteEmpresa),
        // O nome declarado no cadastro é o que a administração precisa conferir contra o documento.
        nomeDeclarado: r.solicitanteEmpresa.razaoSocial,
        tipo: r.solicitanteEmpresa.tipoPessoa,
        documento: documentoParaAdmin(r.solicitanteEmpresa.tipoPessoa, r.solicitanteEmpresa.documento),
        email: emailDe.get(r.solicitanteUsuarioId) ?? "",
        verificada: r.solicitanteEmpresa.verificadaEm !== null,
        criadaEm: r.solicitanteEmpresa.criadoEm,
      },
      receita:
        oficial === undefined
          ? undefined
          : oficial === null
            ? null
            : {
                razaoSocial: oficial.razaoSocial,
                situacao: oficial.situacao,
                ativa: oficial.ativa,
                socios: oficial.socios,
                municipio: oficial.municipio,
                uf: oficial.uf,
                razaoConfere: normalizarBusca(oficial.razaoSocial) === normalizarBusca(r.solicitanteEmpresa.razaoSocial),
              },
      perfil: r.perfil
        ? {
            nome: r.perfil.nome,
            slug: r.perfil.slug,
            tipo: r.perfil.tipo,
            // null: o perfil não tem CNPJ de referência (autônomo ou indicado sem CNPJ); a conferência é humana.
            documentoConfere: r.perfil.documentoIndicado ? r.perfil.documentoIndicado === r.solicitanteEmpresa.documento : null,
            avaliacoes: contagem(avaliacoesPorPerfil, r.perfil.id),
            recomendacoes: contagem(indicacoesPorPerfil, r.perfil.id),
            avaliacoesDoSolicitante: avaliacoesDoSolicitante.filter((a) => a.perfilId === r.perfil?.id && a.avaliadorEmpresaId === r.solicitanteEmpresaId).length,
            outrosPedidosPendentes: Math.max(0, contagem(pendentesPorPerfil, r.perfil.id) - (r.status === "pendente" ? 1 : 0)),
          }
        : undefined,
      avaliacao: r.avaliacao
        ? {
            perfilNome: r.avaliacao.perfil.nome,
            perfilSlug: r.avaliacao.perfil.slug,
            nota: r.avaliacao.nota,
            comentario: r.avaliacao.comentario ?? undefined,
            relacaoContestada: r.avaliacao.verificacaoRelacao?.estado === "contestada",
          }
        : undefined,
      documentos: r.documentos.map((d) => ({ id: d.id, mime: d.mime, tamanho: d.tamanho, apagado: d.apagadoEm !== null })),
    };
  });
}

/** Quantos pedidos esperam análise (cartão da página de administração). */
export async function contarSolicitacoesPendentes(): Promise<number> {
  await exigirAdminAction();
  return prisma.solicitacaoVerificacao.count({ where: PENDENTE_COM_DOCUMENTO });
}

/**
 * Decide um pedido. Aprovar exige ao menos um documento, que o próprio admin tenha aberto antes (fica
 * no registro), e reconfere as condições do tipo; recusar exige motivo, que o solicitante vê. Nos dois
 * casos os documentos são apagados na mesma transação e fica no log o que foi analisado (hash, tipo e
 * tamanho de cada arquivo), sem guardar o arquivo.
 */
export async function decidirSolicitacao(
  solicitacaoId: string,
  decisao: "aprovar" | "recusar",
  motivo: string | undefined,
  senha?: string,
): Promise<ResultadoAction<null>> {
  const admin = await exigirAdminAction();
  return executar(async () => {
    const parsed = decidirSolicitacaoSchema.safeParse({ solicitacaoId, decisao, motivo });
    if (!parsed.success) throw new ErroDeNegocio("Dados inválidos.");
    const dados = parsed.data;
    if (dados.decisao === "recusar" && (dados.motivo ?? "").length < 5) {
      throw new ErroDeNegocio("Explique o motivo da recusa (mínimo 5 letras): o solicitante vai ler.");
    }
    await exigirSenhaDoAdmin(admin.usuarioId, senha);

    await prisma.$transaction(async (tx) => {
      // Mesmo lock do envio e do cancelamento: a decisão não corre com um documento chegando.
      if (!(await travarPedidoPendente(tx, dados.solicitacaoId))) throw new ErroDeNegocio("Pedido não encontrado ou já decidido.");
      const pedido = await tx.solicitacaoVerificacao.findUniqueOrThrow({
        where: { id: dados.solicitacaoId },
        select: { id: true, tipo: true, status: true, solicitanteEmpresaId: true, perfilId: true, avaliacaoId: true },
      });
      if (pedido.solicitanteEmpresaId === admin.empresaId) {
        throw new ErroDeNegocio("Você não pode decidir um pedido da sua própria empresa.");
      }
      const agora = new Date().toISOString();
      const aprovar = dados.decisao === "aprovar";
      const documentos = await tx.arquivo.findMany({
        where: { solicitacaoId: pedido.id, apagadoEm: null },
        select: { id: true, mime: true, tamanho: true, sha256: true },
        orderBy: { criadoEm: "asc" },
      });

      let efeito: Awaited<ReturnType<typeof aplicarAprovacao>> | null = null;
      let concorrentesFechados = 0;
      if (aprovar) {
        if (documentos.length === 0) throw new ErroDeNegocio("O pedido não tem documento. Recuse pedindo o envio.");
        const abertos = await tx.logAdmin.count({
          where: { adminUsuarioId: admin.usuarioId, acao: "documento.visualizar", alvoTipo: "Arquivo", alvoId: { in: documentos.map((d) => d.id) } },
        });
        if (abertos === 0) throw new ErroDeNegocio("Abra e confira o documento antes de aprovar: a aprovação precisa de uma análise registrada.");
        efeito = await aplicarAprovacao(tx, pedido, agora);
      }
      const atualizadas = await tx.solicitacaoVerificacao.updateMany({
        where: { id: pedido.id, status: "pendente" },
        data: {
          status: aprovar ? "aprovada" : "recusada",
          decididaPorUsuarioId: admin.usuarioId,
          decididaEm: agora,
          motivoDecisao: dados.motivo || null,
          atualizadoEm: agora,
        },
      });
      if (atualizadas.count === 0) throw new ErroDeNegocio("Pedido já decidido por outra pessoa.");
      await apagarDocumentos(tx, [pedido.id]);
      if (aprovar && pedido.tipo === "reivindicacao_perfil" && pedido.perfilId) {
        concorrentesFechados = await fecharPedidosConcorrentes(tx, pedido.perfilId, pedido.id, admin.usuarioId, agora);
      }
      await notificarDecisao(
        tx,
        pedido.solicitanteEmpresaId,
        aprovar,
        efeito?.textoNotificacao ?? "",
        efeito?.href ?? "/minha-rede/verificacao",
        dados.motivo,
      );
      await registrarLogAdmin(tx, admin.usuarioId, aprovar ? "verificacao.aprovar" : "verificacao.recusar", "SolicitacaoVerificacao", pedido.id, {
        tipo: pedido.tipo,
        solicitanteEmpresaId: pedido.solicitanteEmpresaId,
        motivo: dados.motivo ?? null,
        documentos: documentos.map((d) => ({ sha256: d.sha256, mime: d.mime, tamanho: d.tamanho })),
        concorrentesFechados,
        ...(efeito?.resumo ?? {}),
      });
    });
    return null;
  });
}

/**
 * Desfaz uma aprovação: revoga o selo, devolve o perfil reivindicado à rede como indicado ou rebaixa a
 * relação comprovada. O pedido passa a "revogada" e o solicitante é avisado (sem o motivo, que fica no log).
 */
export async function desfazerSolicitacao(solicitacaoId: string, motivo: string, senha?: string): Promise<ResultadoAction<null>> {
  const admin = await exigirAdminAction();
  return executar(async () => {
    const parsed = desfazerSolicitacaoSchema.safeParse({ solicitacaoId, motivo });
    if (!parsed.success) throw new ErroDeNegocio(parsed.error.issues[0]?.message ?? "Dados inválidos.");
    await exigirSenhaDoAdmin(admin.usuarioId, senha);

    await prisma.$transaction(async (tx) => {
      const pedido = await tx.solicitacaoVerificacao.findUnique({
        where: { id: parsed.data.solicitacaoId },
        select: { id: true, tipo: true, status: true, solicitanteEmpresaId: true, perfilId: true, avaliacaoId: true },
      });
      if (!pedido || pedido.status !== "aprovada") throw new ErroDeNegocio("Só um pedido aprovado pode ser desfeito.");
      const aprovacao = await tx.logAdmin.findFirst({
        where: { acao: "verificacao.aprovar", alvoTipo: "SolicitacaoVerificacao", alvoId: pedido.id },
        orderBy: { criadoEm: "desc" },
        select: { detalhes: true },
      });
      const agora = new Date().toISOString();
      const marcado = await tx.solicitacaoVerificacao.updateMany({
        where: { id: pedido.id, status: "aprovada" },
        data: { status: "revogada", atualizadoEm: agora, motivoDecisao: "Verificação desfeita pela administração." },
      });
      if (marcado.count === 0) throw new ErroDeNegocio("O pedido já foi desfeito.");
      const efeito = await desfazerEfeito(tx, pedido, aprovacao?.detalhes ?? null, agora);
      await criarNotificacao(
        tx,
        pedido.solicitanteEmpresaId,
        "verificacao_desfeita",
        "Uma verificação aprovada antes foi desfeita pela administração. Se tiver dúvidas, fale com o suporte.",
        "/minha-rede/verificacao",
        { semDedupe: true },
      );
      await registrarLogAdmin(tx, admin.usuarioId, "verificacao.desfazer", "SolicitacaoVerificacao", pedido.id, {
        tipo: pedido.tipo,
        solicitanteEmpresaId: pedido.solicitanteEmpresaId,
        motivo: parsed.data.motivo,
        ...efeito,
      });
    });
    return null;
  });
}
