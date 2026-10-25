import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verificarLimite } from "@/lib/auth/limite";
import { gerarHash } from "@/lib/auth/senha";
import { modulosDisponiveis, normalizarModulos, rotuloDoModulo, TODOS_OS_MODULOS, type ModuloChave } from "@/lib/auth/modulos";
import { fimDaSenhaTemporaria, SENHA_TEMPORARIA, VALIDADE_SENHA_TEMPORARIA_DIAS } from "@/lib/auth/senhaTemporaria.server";
import { normalizarBusca } from "@/lib/rede/texto";
import { alterarModulosSchema, alvoUsuarioSchema, criarUsuarioSchema } from "@/lib/validacao/usuarios";
import type { AcessoTemporario, ListaUsuariosEmpresa, SituacaoUsuarioEmpresa, UsuarioEmpresaItem } from "@/types";
import type { Contexto } from "./calendarioCore.server";
import { exigirSenhaDoDono } from "./reautenticacao.server";
import { ErroDeNegocio } from "./resultado.server";

// Regras da gestão de usuários da empresa, sem depender de sessão: as Server Actions conferem que quem chama é o
// DONO e passam o contexto (usuário e empresa da sessão). O empresaId nunca vem do cliente, e toda ação sobre um
// usuário confere que ele é desta empresa. Quem entra é sempre "membro"; o dono escolhe os módulos dele.

export const LIMITE_USUARIOS_POR_EMPRESA = 25;
const CRIACOES_POR_HORA = 20;
const UMA_HORA_MS = 60 * 60 * 1000;
const MENSAGEM_NAO_FOI_POSSIVEL = "Não foi possível criar este usuário. Confira os dados ou tente outro e-mail.";

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

function acesso(nome: string, email: string, modulos: ModuloChave[], usuarioId?: string): AcessoTemporario {
  return { usuarioId, nome, email, senhaTemporaria: SENHA_TEMPORARIA, validadeDias: VALIDADE_SENHA_TEMPORARIA_DIAS, modulos };
}

/** Módulos que o plano da empresa permite liberar (o gratuito não tem os de gestão). */
export async function modulosDaEmpresa(empresaId: string): Promise<ModuloChave[]> {
  const empresa = await prisma.empresa.findUnique({ where: { id: empresaId }, select: { plano: true } });
  if (!empresa) return [];
  const linhas = await prisma.planoRecurso.findMany({ where: { plano: empresa.plano }, select: { recursoChave: true } });
  return modulosDisponiveis(new Set(linhas.map((l) => l.recursoChave)));
}

/** Os módulos escolhidos precisam existir e caber no plano da empresa. */
async function validarModulos(empresaId: string, escolhidos: readonly ModuloChave[]): Promise<ModuloChave[]> {
  const modulos = normalizarModulos(escolhidos);
  if (modulos.length === 0) throw new ErroDeNegocio("Escolha ao menos um módulo para esta pessoa.");
  const disponiveis = await modulosDaEmpresa(empresaId);
  const fora = modulos.filter((m) => !disponiveis.includes(m));
  if (fora.length > 0) throw new ErroDeNegocio(`O plano da empresa não inclui: ${fora.map(rotuloDoModulo).join(", ")}.`);
  return modulos;
}

/** Usuários da empresa. A senha temporária nunca vem na lista: só ao criar ou redefinir. */
export async function listar(ctx: Contexto): Promise<ListaUsuariosEmpresa> {
  const usuarios = await prisma.usuario.findMany({
    where: { empresaId: ctx.empresaId },
    orderBy: [{ papel: "asc" }, { criadoEm: "asc" }, { id: "asc" }],
    select: {
      id: true,
      nome: true,
      email: true,
      papel: true,
      modulos: true,
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
    modulos: u.papel === "dono" ? [...TODOS_OS_MODULOS] : normalizarModulos(u.modulos),
    situacao: situacaoDe(u),
    criadoEm: u.criadoEm,
    ultimoAcessoEm: ultimoAcesso.get(u.id) ?? undefined,
    voce: u.id === ctx.usuarioId,
  }));
  return { usuarios: itens, limite: LIMITE_USUARIOS_POR_EMPRESA, modulosDisponiveis: await modulosDaEmpresa(ctx.empresaId) };
}

export async function criar(ctx: Contexto, input: unknown, senhaDoDono: string): Promise<AcessoTemporario> {
  const parsed = criarUsuarioSchema.safeParse(input);
  if (!parsed.success) throw new ErroDeNegocio(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  await exigirSenhaDoDono(ctx.usuarioId, senhaDoDono);
  const modulos = await validarModulos(ctx.empresaId, parsed.data.modulos);

  const limite = await verificarLimite(`usuarios-criar:${ctx.empresaId}`, CRIACOES_POR_HORA, UMA_HORA_MS);
  if (!limite.permitido) throw new ErroDeNegocio("Muitos usuários criados em pouco tempo. Tente de novo mais tarde.");

  const existentes = await prisma.usuario.findMany({ where: { empresaId: ctx.empresaId }, select: { nome: true } });
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
  let criadoId: string;
  try {
    const criado = await prisma.usuario.create({
      select: { id: true },
      data: {
        empresaId: ctx.empresaId,
        nome: parsed.data.nome,
        email: parsed.data.email,
        senhaHash: await gerarHash(SENHA_TEMPORARIA),
        papel: "membro",
        modulos,
        trocarSenha: true,
        senhaTemporariaExpiraEm: fimDaSenhaTemporaria(agora),
        criadoEm: iso,
        atualizadoEm: iso,
      },
    });
    criadoId = criado.id;
  } catch (erro) {
    // E-mail já usado (aqui ou em outra empresa): a mesma resposta nos dois casos, para a lista de
    // e-mails cadastrados na plataforma não vazar para quem cria usuários.
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") throw new ErroDeNegocio(MENSAGEM_NAO_FOI_POSSIVEL);
    throw erro;
  }
  return acesso(parsed.data.nome, parsed.data.email, modulos, criadoId);
}

/** Desfaz um usuário que acabou de ser criado (a ficha do funcionário não pôde ser gravada em seguida). */
export async function desfazerCriacao(ctx: Contexto, usuarioId: string): Promise<void> {
  await prisma.usuario.deleteMany({ where: { id: usuarioId, empresaId: ctx.empresaId, papel: "membro" } });
}

/** Alvo precisa ser um membro desta empresa, que não seja o próprio dono da sessão. */
async function obterMembroDaEmpresa(empresaId: string, usuarioIdAlvo: string, usuarioIdSessao: string) {
  const alvo = await prisma.usuario.findFirst({
    where: { id: usuarioIdAlvo, empresaId },
    select: { id: true, nome: true, email: true, papel: true, desativadoEm: true, modulos: true },
  });
  if (!alvo) throw new ErroDeNegocio("Usuário não encontrado.");
  if (alvo.id === usuarioIdSessao || alvo.papel !== "membro") throw new ErroDeNegocio("Não dá para alterar o responsável pela conta.");
  return alvo;
}

function alvoValido(usuarioId: string): string {
  const parsed = alvoUsuarioSchema.safeParse({ usuarioId });
  if (!parsed.success) throw new ErroDeNegocio("Usuário não encontrado.");
  return parsed.data.usuarioId;
}

/** Muda os módulos de um funcionário. Vale já na próxima ação dele (a sessão lê do banco), sem derrubá-la. */
export async function alterarModulos(ctx: Contexto, usuarioId: string, modulosEscolhidos: unknown, senhaDoDono: string): Promise<ModuloChave[]> {
  const parsed = alterarModulosSchema.safeParse({ usuarioId, modulos: modulosEscolhidos });
  if (!parsed.success) throw new ErroDeNegocio(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  await exigirSenhaDoDono(ctx.usuarioId, senhaDoDono);
  const alvo = await obterMembroDaEmpresa(ctx.empresaId, parsed.data.usuarioId, ctx.usuarioId);
  const modulos = await validarModulos(ctx.empresaId, parsed.data.modulos);
  await prisma.usuario.update({ where: { id: alvo.id }, data: { modulos, atualizadoEm: new Date().toISOString() } });
  return modulos;
}

/** Volta o usuário para a senha temporária: ele precisa trocá-la de novo, e as sessões dele caem na hora. */
export async function redefinirAcesso(ctx: Contexto, usuarioId: string, senhaDoDono: string): Promise<AcessoTemporario> {
  const id = alvoValido(usuarioId);
  await exigirSenhaDoDono(ctx.usuarioId, senhaDoDono);
  const alvo = await obterMembroDaEmpresa(ctx.empresaId, id, ctx.usuarioId);
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
  return acesso(alvo.nome, alvo.email, normalizarModulos(alvo.modulos));
}

/** Desativa: o histórico de contas e estoque continua com o nome dele, mas ele não entra mais. */
export async function desativar(ctx: Contexto, usuarioId: string): Promise<void> {
  const alvo = await obterMembroDaEmpresa(ctx.empresaId, alvoValido(usuarioId), ctx.usuarioId);
  const agora = new Date().toISOString();
  const r = await prisma.$transaction([
    prisma.usuario.updateMany({ where: { id: alvo.id, desativadoEm: null }, data: { desativadoEm: agora, atualizadoEm: agora } }),
    prisma.sessao.deleteMany({ where: { usuarioId: alvo.id } }),
  ]);
  if (r[0].count === 0) throw new ErroDeNegocio("Este usuário já está desativado.");
}

export async function reativar(ctx: Contexto, usuarioId: string): Promise<void> {
  const alvo = await obterMembroDaEmpresa(ctx.empresaId, alvoValido(usuarioId), ctx.usuarioId);
  const agora = new Date().toISOString();
  const r = await prisma.usuario.updateMany({ where: { id: alvo.id, desativadoEm: { not: null } }, data: { desativadoEm: null, atualizadoEm: agora } });
  if (r.count === 0) throw new ErroDeNegocio("Este usuário não está desativado.");
}
