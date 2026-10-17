"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { exigirSessaoAction } from "@/lib/auth/dal";
import { verificarLimite } from "@/lib/auth/limite";
import { gerarHash } from "@/lib/auth/senha";
import { fimDaSenhaTemporaria, SENHA_TEMPORARIA, VALIDADE_SENHA_TEMPORARIA_DIAS } from "@/lib/auth/senhaTemporaria.server";
import { normalizarBusca } from "@/lib/rede/texto";
import { alvoUsuarioSchema, criarUsuarioSchema } from "@/lib/validacao/usuarios";
import type { AcessoTemporario, ListaUsuariosEmpresa, ResultadoAction, SituacaoUsuarioEmpresa, UsuarioEmpresaItem } from "@/types";
import { exigirSenhaDoDono } from "./reautenticacao.server";
import { ErroDeNegocio, executar } from "./resultado.server";

// Gestão de usuários da empresa. Só o dono cria, redefine e desativa; quem entra é sempre "membro" (opera
// contas, estoque e cadastros, mas não mexe em usuários, plano nem dados da empresa). O empresaId vem da
// sessão, nunca do cliente, e toda ação sobre um usuário confere que ele é desta empresa.

const LIMITE_USUARIOS_POR_EMPRESA = 25;
const CRIACOES_POR_HORA = 20;
const UMA_HORA_MS = 60 * 60 * 1000;
const MENSAGEM_NAO_FOI_POSSIVEL = "Não foi possível criar este usuário. Confira os dados ou tente outro e-mail.";

async function exigirDonoAction() {
  const sessao = await exigirSessaoAction();
  if (sessao.papel !== "dono") throw new Error("SEM_PERMISSAO");
  return sessao;
}

function situacaoDe(u: {
  desativadoEm: string | null;
  bloqueadoPlataformaEm: string | null;
  trocarSenha: boolean;
  senhaTemporariaExpiraEm: string | null;
}): SituacaoUsuarioEmpresa {
  if (u.desativadoEm) return "desativado";
  if (u.bloqueadoPlataformaEm) return "bloqueado";
  if (u.trocarSenha) {
    const venceu = u.senhaTemporariaExpiraEm ? new Date(u.senhaTemporariaExpiraEm).getTime() <= Date.now() : false;
    return venceu ? "senha_temporaria_vencida" : "aguardando_primeiro_acesso";
  }
  return "ativo";
}

function acesso(nome: string, email: string): AcessoTemporario {
  return { nome, email, senhaTemporaria: SENHA_TEMPORARIA, validadeDias: VALIDADE_SENHA_TEMPORARIA_DIAS };
}

/** Usuários da empresa da sessão. A senha temporária nunca vem na lista: só ao criar ou redefinir. */
export async function listarUsuariosDaEmpresa(): Promise<ResultadoAction<ListaUsuariosEmpresa>> {
  return executar(async () => {
    const sessao = await exigirDonoAction();
    const usuarios = await prisma.usuario.findMany({
      where: { empresaId: sessao.empresaId },
      orderBy: [{ papel: "asc" }, { criadoEm: "asc" }, { id: "asc" }],
      select: {
        id: true,
        nome: true,
        email: true,
        papel: true,
        criadoEm: true,
        desativadoEm: true,
        bloqueadoPlataformaEm: true,
        trocarSenha: true,
        senhaTemporariaExpiraEm: true,
      },
    });
    const acessos = await prisma.sessao.groupBy({
      by: ["usuarioId"],
      where: { usuarioId: { in: usuarios.map((u) => u.id) } },
      _max: { ultimoUsoEm: true },
    });
    const ultimoAcesso = new Map(acessos.map((a) => [a.usuarioId, a._max.ultimoUsoEm]));
    const itens: UsuarioEmpresaItem[] = usuarios.map((u) => ({
      id: u.id,
      nome: u.nome,
      email: u.email,
      papel: u.papel,
      situacao: situacaoDe(u),
      criadoEm: u.criadoEm,
      ultimoAcessoEm: ultimoAcesso.get(u.id) ?? undefined,
      voce: u.id === sessao.usuarioId,
    }));
    return { usuarios: itens, limite: LIMITE_USUARIOS_POR_EMPRESA };
  });
}

export async function criarUsuarioDaEmpresa(input: unknown, senhaDoDono: string): Promise<ResultadoAction<AcessoTemporario>> {
  return executar(async () => {
    const sessao = await exigirDonoAction();
    const parsed = criarUsuarioSchema.safeParse(input);
    if (!parsed.success) throw new ErroDeNegocio(parsed.error.issues[0]?.message ?? "Dados inválidos.");
    await exigirSenhaDoDono(sessao.usuarioId, senhaDoDono);

    const limite = await verificarLimite(`usuarios-criar:${sessao.empresaId}`, CRIACOES_POR_HORA, UMA_HORA_MS);
    if (!limite.permitido) throw new ErroDeNegocio("Muitos usuários criados em pouco tempo. Tente de novo mais tarde.");

    const existentes = await prisma.usuario.findMany({ where: { empresaId: sessao.empresaId }, select: { nome: true } });
    if (existentes.length >= LIMITE_USUARIOS_POR_EMPRESA) {
      throw new ErroDeNegocio(`Cada empresa pode ter até ${LIMITE_USUARIOS_POR_EMPRESA} usuários.`);
    }
    // O nome é o que aparece em "quem lançou" e "quem movimentou": duas pessoas com o mesmo nome se confundiriam.
    const nomeNormalizado = normalizarBusca(parsed.data.nome);
    if (existentes.some((u) => normalizarBusca(u.nome) === nomeNormalizado)) {
      throw new ErroDeNegocio("Já existe um usuário com esse nome nesta empresa. Use o nome completo para diferenciar as pessoas.");
    }

    const agora = new Date();
    const iso = agora.toISOString();
    try {
      await prisma.usuario.create({
        data: {
          empresaId: sessao.empresaId,
          nome: parsed.data.nome,
          email: parsed.data.email,
          senhaHash: await gerarHash(SENHA_TEMPORARIA),
          papel: "membro",
          trocarSenha: true,
          senhaTemporariaExpiraEm: fimDaSenhaTemporaria(agora),
          criadoEm: iso,
          atualizadoEm: iso,
        },
      });
    } catch (erro) {
      // E-mail já usado (aqui ou em outra empresa): a mesma resposta nos dois casos, para a lista de
      // e-mails cadastrados na plataforma não vazar para quem cria usuários.
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") throw new ErroDeNegocio(MENSAGEM_NAO_FOI_POSSIVEL);
      throw erro;
    }
    return acesso(parsed.data.nome, parsed.data.email);
  });
}

/** Alvo precisa ser um membro desta empresa, que não seja o próprio dono da sessão. */
async function obterMembroDaEmpresa(empresaId: string, usuarioIdAlvo: string, usuarioIdSessao: string) {
  const alvo = await prisma.usuario.findFirst({
    where: { id: usuarioIdAlvo, empresaId },
    select: { id: true, nome: true, email: true, papel: true, desativadoEm: true },
  });
  if (!alvo) throw new ErroDeNegocio("Usuário não encontrado.");
  if (alvo.id === usuarioIdSessao || alvo.papel !== "membro") throw new ErroDeNegocio("Não dá para alterar o responsável pela conta.");
  return alvo;
}

/** Volta o usuário para a senha temporária: ele precisa trocá-la de novo, e as sessões dele caem na hora. */
export async function redefinirAcessoDoUsuario(usuarioId: string, senhaDoDono: string): Promise<ResultadoAction<AcessoTemporario>> {
  return executar(async () => {
    const sessao = await exigirDonoAction();
    const parsed = alvoUsuarioSchema.safeParse({ usuarioId });
    if (!parsed.success) throw new ErroDeNegocio("Usuário não encontrado.");
    await exigirSenhaDoDono(sessao.usuarioId, senhaDoDono);
    const alvo = await obterMembroDaEmpresa(sessao.empresaId, parsed.data.usuarioId, sessao.usuarioId);
    if (alvo.desativadoEm) throw new ErroDeNegocio("Reative o usuário antes de redefinir o acesso.");

    const agora = new Date();
    const hash = await gerarHash(SENHA_TEMPORARIA);
    await prisma.$transaction([
      prisma.usuario.update({
        where: { id: alvo.id },
        data: {
          senhaHash: hash,
          trocarSenha: true,
          senhaTemporariaExpiraEm: fimDaSenhaTemporaria(agora),
          falhasLogin: 0,
          bloqueadoAte: null,
          ultimaFalhaLoginEm: null,
          atualizadoEm: agora.toISOString(),
        },
      }),
      prisma.sessao.deleteMany({ where: { usuarioId: alvo.id } }),
    ]);
    return acesso(alvo.nome, alvo.email);
  });
}

/** Desativa: o histórico de contas e estoque continua com o nome dele, mas ele não entra mais. */
export async function desativarUsuarioDaEmpresa(usuarioId: string): Promise<ResultadoAction<null>> {
  return executar(async () => {
    const sessao = await exigirDonoAction();
    const parsed = alvoUsuarioSchema.safeParse({ usuarioId });
    if (!parsed.success) throw new ErroDeNegocio("Usuário não encontrado.");
    const alvo = await obterMembroDaEmpresa(sessao.empresaId, parsed.data.usuarioId, sessao.usuarioId);
    const agora = new Date().toISOString();
    const r = await prisma.$transaction([
      prisma.usuario.updateMany({ where: { id: alvo.id, desativadoEm: null }, data: { desativadoEm: agora, atualizadoEm: agora } }),
      prisma.sessao.deleteMany({ where: { usuarioId: alvo.id } }),
    ]);
    if (r[0].count === 0) throw new ErroDeNegocio("Este usuário já está desativado.");
    return null;
  });
}

export async function reativarUsuarioDaEmpresa(usuarioId: string): Promise<ResultadoAction<null>> {
  return executar(async () => {
    const sessao = await exigirDonoAction();
    const parsed = alvoUsuarioSchema.safeParse({ usuarioId });
    if (!parsed.success) throw new ErroDeNegocio("Usuário não encontrado.");
    const alvo = await obterMembroDaEmpresa(sessao.empresaId, parsed.data.usuarioId, sessao.usuarioId);
    const agora = new Date().toISOString();
    const r = await prisma.usuario.updateMany({ where: { id: alvo.id, desativadoEm: { not: null } }, data: { desativadoEm: null, atualizadoEm: agora } });
    if (r.count === 0) throw new ErroDeNegocio("Este usuário não está desativado.");
    return null;
  });
}
