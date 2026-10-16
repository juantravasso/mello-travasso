"use server";

import { prisma } from "@/lib/prisma";
import { exigirRedeAction } from "@/lib/auth/dal";
import { verificarLimite } from "@/lib/auth/limite";
import { criarSolicitacaoSchema, idSchema } from "@/lib/validacao/verificacao";
import { slugSchema } from "@/lib/validacao/rede";
import type {
  AvaliacaoComprovavel,
  CriarSolicitacaoInput,
  NovaSolicitacao,
  PerfilReivindicavel,
  ResultadoAction,
  SolicitacaoItem,
} from "@/types";
import { cifraDeDocumentosConfigurada } from "./documentoCifra.server";
import { exigirEmailConfirmado } from "./emailConfirmado.server";
import { ErroDeNegocio, executar } from "./resultado.server";
import { apagarDocumentos, expirarPedidosAntigos, MAX_PEDIDOS_ABERTOS_POR_EMPRESA, travarEmpresa } from "./verificacaoCore.server";

const PEDIDOS_POR_DIA = 10;
const UM_DIA_MS = 24 * 60 * 60 * 1000;

const MSG_PERFIL_INDISPONIVEL = "Este perfil não está disponível para reivindicação.";

/** Quem fala pela empresa à administração é o dono da conta, não qualquer usuário dela. */
function exigirDono(sessao: { papel: "dono" | "membro" }): void {
  if (sessao.papel !== "dono") throw new ErroDeNegocio("Só o dono da conta faz pedidos de verificação.");
}

/**
 * Cria um pedido de verificação (pendente). Os documentos são enviados a seguir,
 * pela rota /api/documentos. Nada é verificado nem vinculado até a decisão da
 * administração. Exige e-mail confirmado e a chave de cifra dos documentos.
 */
export async function criarSolicitacao(input: CriarSolicitacaoInput): Promise<ResultadoAction<NovaSolicitacao>> {
  const sessao = await exigirRedeAction();
  return executar(async () => {
    exigirEmailConfirmado(sessao, "pedir verificação");
    exigirDono(sessao);
    if (!cifraDeDocumentosConfigurada()) throw new ErroDeNegocio("O envio de documentos está indisponível no momento. Tente mais tarde.");
    const parsed = criarSolicitacaoSchema.safeParse(input);
    if (!parsed.success) throw new ErroDeNegocio(parsed.error.issues[0]?.message ?? "Dados inválidos.");
    const dados = parsed.data;
    const limite = await verificarLimite(`rede-verificacao:${sessao.empresaId}`, PEDIDOS_POR_DIA, UM_DIA_MS);
    if (!limite.permitido) throw new ErroDeNegocio("Você já enviou muitos pedidos hoje. Tente de novo amanhã.");
    // Limpeza oportunista: pedidos sem análise há 30 dias expiram e perdem os documentos.
    if (Math.random() < 0.1) await expirarPedidosAntigos().catch(() => undefined);

    const id = await prisma.$transaction(async (tx) => {
      await travarEmpresa(tx, sessao.empresaId);
      const empresa = await tx.empresa.findUniqueOrThrow({
        where: { id: sessao.empresaId },
        select: { id: true, documento: true, tipoPessoa: true, verificadaEm: true },
      });
      const abertos = await tx.solicitacaoVerificacao.count({ where: { solicitanteEmpresaId: empresa.id, status: "pendente" } });
      if (abertos >= MAX_PEDIDOS_ABERTOS_POR_EMPRESA) {
        throw new ErroDeNegocio("Você já tem pedidos em análise demais. Aguarde a decisão antes de enviar outros.");
      }

      let perfilId: string | null = null;
      let avaliacaoId: string | null = null;

      if (dados.tipo === "empresa_verificada") {
        if (empresa.verificadaEm) throw new ErroDeNegocio("Sua conta já está verificada.");
        const repetido = await tx.solicitacaoVerificacao.count({
          where: { solicitanteEmpresaId: empresa.id, tipo: "empresa_verificada", status: "pendente" },
        });
        if (repetido > 0) throw new ErroDeNegocio("Você já tem um pedido de verificação em análise.");
      } else if (dados.tipo === "reivindicacao_perfil") {
        const perfil = await tx.perfilPublico.findFirst({
          where: { slug: dados.perfilSlug, status: "indicado", empresaId: null },
          select: { id: true, tipo: true, documentoIndicado: true, indicadoPorEmpresaId: true },
        });
        if (!perfil) throw new ErroDeNegocio(MSG_PERFIL_INDISPONIVEL);
        if (perfil.indicadoPorEmpresaId === empresa.id) {
          throw new ErroDeNegocio("Você criou este perfil por indicação. Não pode reivindicá-lo; peça que a própria pessoa ou empresa o faça.");
        }
        if (perfil.tipo !== empresa.tipoPessoa) throw new ErroDeNegocio("Empresa só reivindica perfil de empresa, e autônomo só perfil de autônomo.");
        if (perfil.documentoIndicado && perfil.documentoIndicado !== empresa.documento) {
          throw new ErroDeNegocio("Este perfil foi indicado com outro CNPJ. Só a empresa titular desse CNPJ pode reivindicá-lo.");
        }
        const repetido = await tx.solicitacaoVerificacao.count({
          where: { solicitanteEmpresaId: empresa.id, perfilId: perfil.id, status: "pendente" },
        });
        if (repetido > 0) throw new ErroDeNegocio("Você já tem um pedido em análise para este perfil.");
        perfilId = perfil.id;
      } else {
        const avaliacao = await tx.avaliacao.findFirst({
          where: { id: dados.avaliacaoId, avaliadorEmpresaId: empresa.id, status: "publicada" },
          select: { id: true, statusVerificacao: true },
        });
        if (!avaliacao) throw new ErroDeNegocio("Avaliação não encontrada.");
        if (avaliacao.statusVerificacao === "relacao_comprovada") throw new ErroDeNegocio("A relação desta avaliação já está comprovada.");
        const repetido = await tx.solicitacaoVerificacao.count({
          where: { avaliacaoId: avaliacao.id, status: "pendente" },
        });
        if (repetido > 0) throw new ErroDeNegocio("Você já tem um pedido em análise para esta avaliação.");
        avaliacaoId = avaliacao.id;
      }

      const agora = new Date().toISOString();
      const criada = await tx.solicitacaoVerificacao.create({
        data: {
          tipo: dados.tipo,
          solicitanteEmpresaId: empresa.id,
          solicitanteUsuarioId: sessao.usuarioId,
          perfilId,
          avaliacaoId,
          observacao: dados.observacao || null,
          criadoEm: agora,
          atualizadoEm: agora,
        },
        select: { id: true },
      });
      return criada.id;
    });
    return { id };
  });
}

/** Pedidos da empresa da sessão, os mais recentes primeiro. */
export async function listarMinhasSolicitacoes(): Promise<SolicitacaoItem[]> {
  const sessao = await exigirRedeAction();
  const registros = await prisma.solicitacaoVerificacao.findMany({
    where: { solicitanteEmpresaId: sessao.empresaId },
    include: {
      perfil: { select: { nome: true, slug: true } },
      avaliacao: { select: { nota: true, perfil: { select: { nome: true } } } },
      _count: { select: { documentos: { where: { apagadoEm: null } } } },
    },
    orderBy: [{ criadoEm: "desc" }, { id: "asc" }],
    take: 50,
  });
  return registros.map((r) => ({
    id: r.id,
    tipo: r.tipo,
    status: r.status,
    criadoEm: r.criadoEm,
    decididaEm: r.decididaEm ?? undefined,
    motivoDecisao: r.motivoDecisao ?? undefined,
    observacao: r.observacao ?? undefined,
    documentos: r._count.documentos,
    perfilNome: r.perfil?.nome,
    perfilSlug: r.perfil?.slug,
    avaliacao: r.avaliacao ? { perfilNome: r.avaliacao.perfil.nome, nota: r.avaliacao.nota } : undefined,
  }));
}

/** Retira um pedido pendente e apaga os documentos enviados. */
export async function cancelarSolicitacao(solicitacaoId: string): Promise<ResultadoAction<null>> {
  const sessao = await exigirRedeAction();
  return executar(async () => {
    exigirDono(sessao);
    const parsed = idSchema.safeParse(solicitacaoId);
    if (!parsed.success) throw new ErroDeNegocio("Pedido não encontrado.");
    await prisma.$transaction(async (tx) => {
      await travarEmpresa(tx, sessao.empresaId);
      const agora = new Date().toISOString();
      const atualizadas = await tx.solicitacaoVerificacao.updateMany({
        where: { id: parsed.data, solicitanteEmpresaId: sessao.empresaId, status: "pendente" },
        data: { status: "cancelada", atualizadoEm: agora, decididaEm: agora },
      });
      if (atualizadas.count === 0) throw new ErroDeNegocio("Pedido não encontrado ou já decidido.");
      await apagarDocumentos(tx, [parsed.data]);
    });
    return null;
  });
}

/** Dados do perfil indicado que a empresa quer reivindicar, para a tela do pedido. */
export async function obterPerfilReivindicavel(slug: string): Promise<ResultadoAction<PerfilReivindicavel>> {
  const sessao = await exigirRedeAction();
  return executar(async () => {
    const parsed = slugSchema.safeParse(slug);
    if (!parsed.success) throw new ErroDeNegocio(MSG_PERFIL_INDISPONIVEL);
    const [perfil, empresa] = await Promise.all([
      prisma.perfilPublico.findFirst({
        where: { slug: parsed.data, status: "indicado", empresaId: null },
        select: { slug: true, nome: true, tipo: true, cidade: true, estado: true, documentoIndicado: true, indicadoPorEmpresaId: true },
      }),
      prisma.empresa.findUniqueOrThrow({
        where: { id: sessao.empresaId },
        select: { documento: true, tipoPessoa: true, perfilPublico: { select: { id: true } } },
      }),
    ]);
    if (!perfil) throw new ErroDeNegocio(MSG_PERFIL_INDISPONIVEL);
    if (perfil.indicadoPorEmpresaId === sessao.empresaId) {
      throw new ErroDeNegocio("Você criou este perfil por indicação. Não pode reivindicá-lo.");
    }
    if (perfil.tipo !== empresa.tipoPessoa) throw new ErroDeNegocio("Empresa só reivindica perfil de empresa, e autônomo só perfil de autônomo.");
    return {
      slug: perfil.slug,
      nome: perfil.nome,
      tipo: perfil.tipo,
      cidade: perfil.cidade ?? undefined,
      estado: perfil.estado ?? undefined,
      documentoConfere: !perfil.documentoIndicado || perfil.documentoIndicado === empresa.documento,
      temRascunho: !!empresa.perfilPublico,
    };
  });
}

/** Avaliação da empresa que ela pode tentar comprovar. */
export async function obterAvaliacaoComprovavel(avaliacaoId: string): Promise<ResultadoAction<AvaliacaoComprovavel>> {
  const sessao = await exigirRedeAction();
  return executar(async () => {
    const parsed = idSchema.safeParse(avaliacaoId);
    if (!parsed.success) throw new ErroDeNegocio("Avaliação não encontrada.");
    const avaliacao = await prisma.avaliacao.findFirst({
      where: { id: parsed.data, avaliadorEmpresaId: sessao.empresaId, status: "publicada" },
      select: { id: true, nota: true, statusVerificacao: true, perfil: { select: { nome: true } } },
    });
    if (!avaliacao) throw new ErroDeNegocio("Avaliação não encontrada.");
    if (avaliacao.statusVerificacao === "relacao_comprovada") throw new ErroDeNegocio("A relação desta avaliação já está comprovada.");
    return { id: avaliacao.id, perfilNome: avaliacao.perfil.nome, nota: avaliacao.nota };
  });
}
