"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { exigirRedeAction } from "@/lib/auth/dal";
import { verificarLimite } from "@/lib/auth/limite";
import { normalizarDocumento } from "@/lib/documento";
import { indicarEmpresaSchema } from "@/lib/validacao/rede";
import { gerarSlug, normalizarBusca } from "@/lib/rede/texto";
import type { IndicacaoItem, IndicarEmpresaInput, ResultadoAction } from "@/types";
import {
  ehProprio,
  nomePublicoDaEmpresa,
  registrarRecomendacao,
  selecaoEmpresaParaNome,
  STATUS_VISIVEIS,
} from "./avaliacaoCore.server";
import { exigirEmailConfirmado } from "./emailConfirmado.server";
import { ErroDeNegocio, executar } from "./resultado.server";

const TENTATIVAS_POR_DIA = 40;
const INDICACOES_NOVAS_POR_DIA = 5;
const UM_DIA_MS = 24 * 60 * 60 * 1000;
const MENSAGEM_NAO_FOI_POSSIVEL = "Não foi possível indicar esta empresa.";

const statusVisiveis = STATUS_VISIVEIS as readonly string[];

function ehConflito(erro: unknown): boolean {
  return erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002";
}

/**
 * Indica uma empresa ou autônomo que ainda não tem cadastro: cria um perfil
 * básico ("indicado"), público, sem nenhum contato — dados de contato de
 * terceiros só entram quando a própria pessoa assumir o perfil. Evita
 * duplicidade por CNPJ (empresas) ou por nome + cidade + estado.
 */
export async function indicarEmpresa(
  input: IndicarEmpresaInput,
): Promise<ResultadoAction<{ slug: string; jaExistia: boolean }>> {
  const sessao = await exigirRedeAction();
  return executar(async () => {
    exigirEmailConfirmado(sessao, "indicar empresas");
    // Teto geral logo de início: as consultas abaixo (CNPJ já cadastrado, perfil
    // parecido) não podem virar um oráculo ilimitado nem um jeito de contornar
    // o limite de recomendações.
    const tentativas = await verificarLimite(`rede-indicar-tentativas:${sessao.empresaId}`, TENTATIVAS_POR_DIA, UM_DIA_MS);
    if (!tentativas.permitido) throw new ErroDeNegocio("Você já fez muitas indicações hoje. Tente de novo amanhã.");

    const parsed = indicarEmpresaSchema.safeParse(input);
    if (!parsed.success) throw new ErroDeNegocio(parsed.error.issues[0]?.message ?? "Dados inválidos.");
    const dados = parsed.data;

    const profissao = await prisma.profissao.findFirst({ where: { id: dados.profissaoId, ativo: true }, select: { id: true } });
    if (!profissao) throw new ErroDeNegocio("A profissão escolhida não está disponível.");

    const empresa = await prisma.empresa.findUniqueOrThrow({
      where: { id: sessao.empresaId },
      select: { id: true, documento: true, ...selecaoEmpresaParaNome },
    });
    const recomendar = (perfil: { id: string; empresaId: string | null }) =>
      registrarRecomendacao(sessao.empresaId, perfil, `${nomePublicoDaEmpresa(empresa).nome} recomendou seu perfil.`);

    const documento = dados.tipo === "pj" ? normalizarDocumento(dados.documento) : undefined;
    const nomeBusca = normalizarBusca(dados.nome);
    const cidadeBusca = normalizarBusca(dados.cidade);

    if (documento) {
      if (empresa.documento === documento) throw new ErroDeNegocio("Este é o CNPJ da sua própria empresa.");

      const cadastrada = await prisma.empresa.findUnique({
        where: { documento },
        select: { perfilPublico: { select: { id: true, slug: true, status: true, empresaId: true } } },
      });
      if (cadastrada) {
        const perfil = cadastrada.perfilPublico;
        // Mesma resposta para "sem cadastro" e "cadastrada sem perfil publicado":
        // não confirma a ninguém que um CNPJ é cliente da plataforma.
        if (!perfil || !statusVisiveis.includes(perfil.status)) throw new ErroDeNegocio(MENSAGEM_NAO_FOI_POSSIVEL);
        await recomendar(perfil);
        return { slug: perfil.slug, jaExistia: true };
      }

      const jaIndicado = await prisma.perfilPublico.findUnique({
        where: { documentoIndicado: documento },
        select: { id: true, slug: true, status: true, empresaId: true },
      });
      if (jaIndicado) {
        if (!statusVisiveis.includes(jaIndicado.status)) throw new ErroDeNegocio(MENSAGEM_NAO_FOI_POSSIVEL);
        await recomendar(jaIndicado);
        return { slug: jaIndicado.slug, jaExistia: true };
      }
    } else {
      const parecido = await prisma.perfilPublico.findFirst({
        where: { status: { in: [...STATUS_VISIVEIS] }, nomeBusca, cidadeBusca, estado: dados.estado },
        select: { id: true, slug: true, empresaId: true, documentoIndicado: true, indicadoPorEmpresaId: true },
      });
      if (parecido) {
        if (ehProprio(parecido, empresa)) throw new ErroDeNegocio("Este já é o seu próprio perfil na rede.");
        await recomendar(parecido);
        return { slug: parecido.slug, jaExistia: true };
      }
    }

    const limite = await verificarLimite(`rede-indicar:${sessao.empresaId}`, INDICACOES_NOVAS_POR_DIA, UM_DIA_MS);
    if (!limite.permitido) throw new ErroDeNegocio("Você já indicou muitas empresas hoje. Tente de novo amanhã.");

    const agora = new Date().toISOString();
    const base = gerarSlug(dados.nome);
    for (let tentativa = 1; tentativa <= 6; tentativa++) {
      const slug =
        dados.tipo === "pf"
          ? `profissional-${crypto.randomUUID().slice(0, 8)}`
          : tentativa === 1
            ? base
            : `${base}-${tentativa === 6 ? crypto.randomUUID().slice(0, 6) : tentativa}`;
      try {
        await prisma.$transaction(async (tx) => {
          const perfil = await tx.perfilPublico.create({
            data: {
              slug,
              tipo: dados.tipo,
              status: "indicado",
              nome: dados.nome,
              nomeFantasia: null,
              razaoSocial: null,
              nomeBusca,
              estado: dados.estado,
              cidade: dados.cidade,
              cidadeBusca,
              documentoIndicado: documento ?? null,
              indicadoPorEmpresaId: sessao.empresaId,
              criadoEm: agora,
              atualizadoEm: agora,
            },
          });
          await tx.perfilProfissao.create({ data: { perfilId: perfil.id, profissaoId: profissao.id } });
          await tx.indicacao.create({
            data: { perfilId: perfil.id, indicadoPorEmpresaId: sessao.empresaId, criadoEm: agora },
          });
        });
        return { slug, jaExistia: false };
      } catch (erro) {
        if (!ehConflito(erro)) throw erro;
        if (documento) {
          // Duas indicações do mesmo CNPJ ao mesmo tempo: usa a que ganhou.
          const existente = await prisma.perfilPublico.findUnique({
            where: { documentoIndicado: documento },
            select: { id: true, slug: true, empresaId: true },
          });
          if (existente) {
            await recomendar(existente);
            return { slug: existente.slug, jaExistia: true };
          }
        }
        // Senão foi colisão de slug: tenta o próximo sufixo.
      }
    }
    throw new ErroDeNegocio("Não foi possível criar a indicação agora. Tente novamente.");
  });
}

export async function listarMinhasIndicacoes(): Promise<IndicacaoItem[]> {
  const sessao = await exigirRedeAction();
  const registros = await prisma.indicacao.findMany({
    where: { indicadoPorEmpresaId: sessao.empresaId, perfil: { status: { in: [...STATUS_VISIVEIS] } } },
    include: { perfil: { select: { slug: true, nome: true, status: true, cidade: true, estado: true } } },
    orderBy: [{ criadoEm: "desc" }, { id: "asc" }],
    take: 200,
  });
  return registros.map((i) => ({
    perfilSlug: i.perfil.slug,
    perfilNome: i.perfil.nome,
    perfilIndicado: i.perfil.status === "indicado",
    cidade: i.perfil.cidade ?? undefined,
    estado: i.perfil.estado ?? undefined,
    criadoEm: i.criadoEm,
  }));
}
