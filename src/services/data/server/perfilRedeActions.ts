"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { exigirRedeAction } from "@/lib/auth/dal";
import { verificarLimite } from "@/lib/auth/limite";
import { salvarPerfilSchema } from "@/lib/validacao/rede";
import { gerarSlug, normalizarBusca } from "@/lib/rede/texto";
import { SIGLAS_UF } from "@/lib/rede/ufs";
import type { MeuPerfil, ResultadoAction, SalvarPerfilInput } from "@/types";
import { criarNotificacao } from "./avaliacaoCore.server";
import { exigirEmailConfirmado } from "./emailConfirmado.server";
import { ErroDeNegocio, executar } from "./resultado.server";

type PerfilRegistro = Prisma.PerfilPublicoGetPayload<{
  include: { profissoes: { include: { profissao: true } } };
}>;

const incluirProfissoes = { profissoes: { include: { profissao: true } } } as const;

const SALVAMENTOS_POR_HORA = 60;

function paraMeuPerfil(perfil: PerfilRegistro): MeuPerfil {
  return {
    slug: perfil.slug,
    tipo: perfil.tipo,
    status: perfil.status,
    nome: perfil.nome,
    nomeFantasia: perfil.nomeFantasia ?? undefined,
    razaoSocial: perfil.razaoSocial ?? undefined,
    descricao: perfil.descricao ?? undefined,
    estado: perfil.estado ?? undefined,
    cidade: perfil.cidade ?? undefined,
    regiao: perfil.regiao ?? undefined,
    areasAtendimento: perfil.areasAtendimento,
    telefone: perfil.telefone ?? undefined,
    telefonePublico: perfil.telefonePublico,
    whatsapp: perfil.whatsapp ?? undefined,
    whatsappPublico: perfil.whatsappPublico,
    instagram: perfil.instagram ?? undefined,
    site: perfil.site ?? undefined,
    profissaoIds: perfil.profissoes.filter((pp) => pp.profissao.ativo).map((pp) => pp.profissaoId),
  };
}

/** Só nome e nome fantasia entram na busca: a razão social de MEI traz o CPF. */
function textoBuscaNome(nome: string, nomeFantasia?: string | null): string {
  return normalizarBusca([nome, nomeFantasia].filter(Boolean).join(" "));
}

/** O que ainda falta preencher para o perfil poder ser publicado. */
function faltaParaPublicar(dados: {
  nome?: string | null;
  estado?: string | null;
  cidade?: string | null;
  quantidadeProfissoes: number;
}): string[] {
  const faltas: string[] = [];
  if (!dados.nome) faltas.push("nome");
  if (!dados.estado || !SIGLAS_UF.includes(dados.estado)) faltas.push("estado");
  if (!dados.cidade) faltas.push("cidade");
  if (dados.quantidadeProfissoes === 0) faltas.push("pelo menos uma profissão");
  return faltas;
}

async function criarPerfilInicial(empresaId: string): Promise<PerfilRegistro> {
  const empresa = await prisma.empresa.findUnique({ where: { id: empresaId } });
  if (!empresa) throw new ErroDeNegocio("Empresa não encontrada.");

  const nome = empresa.nomeFantasia ?? empresa.razaoSocial;
  const ehPf = empresa.tipoPessoa === "pf";
  const base = gerarSlug(nome);
  const agora = new Date().toISOString();
  const ufCadastro = empresa.estado?.toUpperCase();
  const estado = ufCadastro && SIGLAS_UF.includes(ufCadastro) ? ufCadastro : null;

  for (let tentativa = 1; tentativa <= 6; tentativa++) {
    // Autônomo (PF): o nome civil não vai para a URL, que fica no sitemap e no
    // canonical e nunca muda. Empresa (PJ): nome fantasia/razão social.
    const slug = ehPf
      ? `profissional-${crypto.randomUUID().slice(0, 8)}`
      : tentativa === 1
        ? base
        : `${base}-${tentativa === 6 ? crypto.randomUUID().slice(0, 6) : tentativa}`;
    try {
      return await prisma.perfilPublico.create({
        data: {
          slug,
          tipo: empresa.tipoPessoa,
          nome,
          nomeFantasia: empresa.tipoPessoa === "pj" ? empresa.nomeFantasia : null,
          razaoSocial: empresa.tipoPessoa === "pj" ? empresa.razaoSocial : null,
          nomeBusca: textoBuscaNome(nome, ehPf ? null : empresa.nomeFantasia),
          estado,
          cidade: empresa.cidade,
          cidadeBusca: empresa.cidade ? normalizarBusca(empresa.cidade) : null,
          telefone: empresa.telefone,
          empresaId,
          criadoEm: agora,
          atualizadoEm: agora,
        },
        include: incluirProfissoes,
      });
    } catch (erro) {
      if (!(erro instanceof Prisma.PrismaClientKnownRequestError) || erro.code !== "P2002") throw erro;
      // Corrida de duas abas criando o perfil da mesma empresa: devolve o que ganhou.
      const existente = await prisma.perfilPublico.findUnique({ where: { empresaId }, include: incluirProfissoes });
      if (existente) return existente;
      // Senão foi colisão de slug: tenta o próximo sufixo.
    }
  }
  throw new ErroDeNegocio("Não foi possível criar o perfil agora. Tente novamente.");
}

/** Perfil da empresa da sessão; cria o rascunho na primeira vez (a partir dos dados do cadastro). */
async function obterMeuPerfilInterno(): Promise<MeuPerfil> {
  const sessao = await exigirRedeAction();
  const existente = await prisma.perfilPublico.findUnique({
    where: { empresaId: sessao.empresaId },
    include: incluirProfissoes,
  });
  return paraMeuPerfil(existente ?? (await criarPerfilInicial(sessao.empresaId)));
}

async function salvarMeuPerfilInterno(input: SalvarPerfilInput): Promise<MeuPerfil> {
  const sessao = await exigirRedeAction();
  const parsed = salvarPerfilSchema.safeParse(input);
  if (!parsed.success) throw new ErroDeNegocio(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const dados = parsed.data;

  const limite = await verificarLimite(`rede-perfil:${sessao.empresaId}`, SALVAMENTOS_POR_HORA, 60 * 60 * 1000);
  if (!limite.permitido) throw new ErroDeNegocio("Muitas alterações seguidas. Tente de novo mais tarde.");

  const perfil = await prisma.perfilPublico.findUnique({ where: { empresaId: sessao.empresaId } });
  if (!perfil) throw new ErroDeNegocio("Perfil não encontrado.");

  const idsProfissoes = [...new Set(dados.profissaoIds)];
  const validas = await prisma.profissao.count({ where: { id: { in: idsProfissoes }, ativo: true } });
  if (validas !== idsProfissoes.length) throw new ErroDeNegocio("Alguma profissão escolhida não está mais disponível.");

  if (perfil.status === "publicado") {
    const faltas = faltaParaPublicar({
      nome: dados.nome,
      estado: dados.estado,
      cidade: dados.cidade,
      quantidadeProfissoes: idsProfissoes.length,
    });
    if (faltas.length > 0) {
      throw new ErroDeNegocio(`Para manter o perfil publicado, preencha: ${faltas.join(", ")}.`);
    }
  }

  const tipoPj = perfil.tipo === "pj";
  const mudouNome = normalizarBusca(dados.nome) !== normalizarBusca(perfil.nome);
  const atualizado = await prisma.$transaction(async (tx) => {
    // O selo de verificado vale para o nome que foi conferido: trocar o nome público o remove (a empresa
    // pede de novo), para que o selo não passe a abonar outro nome.
    if (mudouNome) {
      const agora = new Date().toISOString();
      const removido = await tx.empresa.updateMany({
        where: { id: sessao.empresaId, verificadaEm: { not: null } },
        data: { verificadaEm: null, atualizadoEm: agora },
      });
      if (removido.count > 0) {
        await criarNotificacao(
          tx,
          sessao.empresaId,
          "selo_removido",
          "O nome público do perfil mudou, então o selo de verificado foi removido. Peça uma nova verificação.",
          "/minha-rede/verificacao",
          { semDedupe: true },
        );
      }
    }
    await tx.perfilProfissao.deleteMany({ where: { perfilId: perfil.id } });
    await tx.perfilProfissao.createMany({
      data: idsProfissoes.map((profissaoId) => ({ perfilId: perfil.id, profissaoId })),
    });
    return tx.perfilPublico.update({
      where: { id: perfil.id },
      data: {
        nome: dados.nome,
        nomeFantasia: tipoPj ? (dados.nomeFantasia ?? null) : null,
        nomeBusca: textoBuscaNome(dados.nome, tipoPj ? dados.nomeFantasia : null),
        descricao: dados.descricao ?? null,
        estado: dados.estado ?? null,
        cidade: dados.cidade ?? null,
        cidadeBusca: dados.cidade ? normalizarBusca(dados.cidade) : null,
        regiao: dados.regiao ?? null,
        areasAtendimento: dados.areasAtendimento,
        telefone: dados.telefone ?? null,
        telefonePublico: dados.telefone ? dados.telefonePublico : false,
        whatsapp: dados.whatsapp ?? null,
        whatsappPublico: dados.whatsapp ? dados.whatsappPublico : false,
        instagram: dados.instagram ?? null,
        site: dados.site ?? null,
        atualizadoEm: new Date().toISOString(),
      },
      include: incluirProfissoes,
    });
  });
  return paraMeuPerfil(atualizado);
}

/** Publica ou volta o perfil para rascunho. Perfil suspenso pela administração não pode ser republicado. */
async function definirPublicacaoInterno(publicar: boolean): Promise<MeuPerfil> {
  const sessao = await exigirRedeAction();
  // Despublicar nunca é barrado; publicar exige e-mail confirmado.
  if (publicar) exigirEmailConfirmado(sessao, "publicar seu perfil");
  const perfil = await prisma.perfilPublico.findUnique({
    where: { empresaId: sessao.empresaId },
    include: incluirProfissoes,
  });
  if (!perfil) throw new ErroDeNegocio("Perfil não encontrado.");
  if (perfil.status === "suspenso") {
    throw new ErroDeNegocio("Este perfil foi suspenso pela administração. Entre em contato com o suporte.");
  }

  if (publicar) {
    const faltas = faltaParaPublicar({
      nome: perfil.nome,
      estado: perfil.estado,
      cidade: perfil.cidade,
      quantidadeProfissoes: perfil.profissoes.filter((pp) => pp.profissao.ativo).length,
    });
    if (faltas.length > 0) throw new ErroDeNegocio(`Para publicar, preencha: ${faltas.join(", ")}.`);
  }

  // status != suspenso no where: se a administração suspender entre a leitura
  // acima e esta escrita, a suspensão prevalece.
  const resultado = await prisma.perfilPublico.updateMany({
    where: { id: perfil.id, status: { not: "suspenso" } },
    data: { status: publicar ? "publicado" : "rascunho", atualizadoEm: new Date().toISOString() },
  });
  if (resultado.count === 0) throw new ErroDeNegocio("Este perfil foi suspenso pela administração.");

  const atual = await prisma.perfilPublico.findUniqueOrThrow({ where: { id: perfil.id }, include: incluirProfissoes });
  return paraMeuPerfil(atual);
}

export async function obterMeuPerfil(): Promise<ResultadoAction<MeuPerfil>> {
  return executar(obterMeuPerfilInterno);
}

export async function salvarMeuPerfil(input: SalvarPerfilInput): Promise<ResultadoAction<MeuPerfil>> {
  return executar(() => salvarMeuPerfilInterno(input));
}

export async function definirPublicacao(publicar: boolean): Promise<ResultadoAction<MeuPerfil>> {
  // Server Actions são alcançáveis por POST direto: o tipo do TS não vale em runtime.
  if (typeof publicar !== "boolean") return { ok: false, erro: "VALIDACAO", mensagem: "Dados inválidos." };
  return executar(() => definirPublicacaoInterno(publicar));
}
