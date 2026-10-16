"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { exigirRedeAction } from "@/lib/auth/dal";
import { verificarLimite } from "@/lib/auth/limite";
import { complementarDenunciaSchema, denunciarSchema } from "@/lib/validacao/rede";
import type { DenunciarInput, MinhaDenuncia, ResultadoAction } from "@/types";
import { ehProprio, IDADE_MINIMA_CONTA_MS, STATUS_VISIVEIS } from "./avaliacaoCore.server";
import { exigirEmailConfirmado } from "./emailConfirmado.server";
import { ErroDeNegocio, executar } from "./resultado.server";

const DENUNCIAS_POR_DIA = 10;
const DENUNCIAS_ABERTAS_MAX = 20;
const UM_DIA_MS = 24 * 60 * 60 * 1000;

function ehConflito(erro: unknown): boolean {
  return erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002";
}

/**
 * Denuncia uma avaliação ou um perfil. Exige conta (visitante não denuncia).
 * A denúncia só entra numa fila: nada é ocultado ou removido por ela, só por
 * decisão da administração. Uma denúncia por par (denunciante, alvo), com
 * teto diário, para o recurso não virar ferramenta de assédio.
 */
export async function denunciar(input: DenunciarInput): Promise<ResultadoAction<null>> {
  const sessao = await exigirRedeAction();
  return executar(async () => {
    exigirEmailConfirmado(sessao, "enviar denúncias");
    const parsed = denunciarSchema.safeParse(input);
    if (!parsed.success) throw new ErroDeNegocio(parsed.error.issues[0]?.message ?? "Dados inválidos.");
    const { alvo, motivo, descricao } = parsed.data;

    // Conta recém-criada não denuncia (como não avalia): barra o uso descartável da fila.
    const conta = await prisma.empresa.findUniqueOrThrow({ where: { id: sessao.empresaId }, select: { criadoEm: true } });
    if (Date.now() - new Date(conta.criadoEm).getTime() < IDADE_MINIMA_CONTA_MS) {
      throw new ErroDeNegocio("Sua conta precisa ter pelo menos 24 horas para enviar denúncias. Volte amanhã.");
    }
    const abertas = await prisma.denuncia.count({
      where: { denuncianteEmpresaId: sessao.empresaId, status: { in: ["aberta", "em_analise", "aguardando_informacoes"] } },
    });
    if (abertas >= DENUNCIAS_ABERTAS_MAX) {
      throw new ErroDeNegocio("Você já tem muitas denúncias em análise. Aguarde a resposta antes de enviar outras.");
    }
    const limite = await verificarLimite(`rede-denunciar:${sessao.empresaId}`, DENUNCIAS_POR_DIA, UM_DIA_MS);
    if (!limite.permitido) throw new ErroDeNegocio("Você já enviou muitas denúncias hoje. Tente de novo amanhã.");

    let avaliacaoId: string | null = null;
    let perfilId: string | null = null;

    if (alvo.tipo === "avaliacao") {
      const avaliacao = await prisma.avaliacao.findFirst({
        where: { id: alvo.avaliacaoId, status: "publicada" },
        select: { id: true, avaliadorEmpresaId: true },
      });
      if (!avaliacao) throw new ErroDeNegocio("Avaliação não encontrada.");
      if (avaliacao.avaliadorEmpresaId === sessao.empresaId) {
        throw new ErroDeNegocio("Você não pode denunciar a própria avaliação. Para apagá-la, fale com o suporte.");
      }
      avaliacaoId = avaliacao.id;
    } else {
      const perfil = await prisma.perfilPublico.findFirst({
        where: { slug: alvo.perfilSlug, status: { in: [...STATUS_VISIVEIS] } },
        select: { id: true, empresaId: true, documentoIndicado: true, indicadoPorEmpresaId: true },
      });
      if (!perfil) throw new ErroDeNegocio("Perfil não encontrado.");
      const empresa = await prisma.empresa.findUniqueOrThrow({
        where: { id: sessao.empresaId },
        select: { id: true, documento: true },
      });
      if (ehProprio(perfil, empresa)) throw new ErroDeNegocio("Este é o seu próprio perfil.");
      perfilId = perfil.id;
    }

    const agora = new Date().toISOString();
    try {
      await prisma.denuncia.create({
        data: {
          denuncianteEmpresaId: sessao.empresaId,
          denuncianteUsuarioId: sessao.usuarioId,
          avaliacaoId,
          perfilId,
          motivo,
          descricao,
          criadoEm: agora,
          atualizadoEm: agora,
        },
      });
    } catch (erro) {
      if (ehConflito(erro)) {
        throw new ErroDeNegocio("Você já denunciou este conteúdo. Acompanhe em Minhas denúncias.");
      }
      throw erro;
    }
    return null;
  });
}

export async function listarMinhasDenuncias(): Promise<MinhaDenuncia[]> {
  const sessao = await exigirRedeAction();
  const registros = await prisma.denuncia.findMany({
    where: { denuncianteEmpresaId: sessao.empresaId },
    include: {
      avaliacao: { select: { perfil: { select: { nome: true } } } },
      perfil: { select: { nome: true } },
    },
    orderBy: [{ criadoEm: "desc" }, { id: "asc" }],
    take: 100,
  });
  return registros.map((d) => ({
    id: d.id,
    alvoTipo: d.avaliacaoId ? "avaliacao" : "perfil",
    alvoRotulo: d.avaliacao ? `Avaliação sobre ${d.avaliacao.perfil.nome}` : `Perfil ${d.perfil?.nome ?? ""}`.trim(),
    motivo: d.motivo,
    status: d.status,
    criadoEm: d.criadoEm,
    mensagem: d.mensagemAoDenunciante ?? undefined,
    complemento: d.complemento ?? undefined,
  }));
}

/** Resposta do denunciante a um pedido de informações da administração. */
export async function complementarDenuncia(denunciaId: string, texto: string): Promise<ResultadoAction<null>> {
  const sessao = await exigirRedeAction();
  return executar(async () => {
    const parsed = complementarDenunciaSchema.safeParse({ denunciaId, texto });
    if (!parsed.success) throw new ErroDeNegocio(parsed.error.issues[0]?.message ?? "Dados inválidos.");
    const atualizados = await prisma.denuncia.updateMany({
      where: {
        id: parsed.data.denunciaId,
        denuncianteEmpresaId: sessao.empresaId,
        status: "aguardando_informacoes",
      },
      data: { complemento: parsed.data.texto, status: "em_analise", atualizadoEm: new Date().toISOString() },
    });
    if (atualizados.count === 0) throw new ErroDeNegocio("Esta denúncia não está esperando informações.");
    return null;
  });
}
