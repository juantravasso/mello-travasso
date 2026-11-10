import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verificarLimite } from "@/lib/auth/limite";
import {
  expiracaoDoConvite,
  gerarTokenConviteFuncionario,
  hashDoToken,
  linkDoConviteFuncionario,
  tokenConviteFuncionarioValido,
} from "@/lib/conviteFuncionario";
import { cadastroPublicoFuncionarioSchema, criarConviteFuncionarioSchema, idConviteSchema } from "@/lib/validacao/conviteFuncionario";
import { novoFuncionarioSchema } from "@/lib/validacao/funcionarios";
import type {
  ConviteFuncionarioCriado,
  ConviteFuncionarioItem,
  ConvitePublicoFuncionario,
  DadosCadastroFuncionario,
  Funcionario,
  SituacaoConviteFuncionario,
} from "@/types";
import { ErroDeNegocio } from "./resultado.server";

// Cadastro de funcionário por link. O dono gera um link individual (uso único, 7 dias); a pessoa preenche os próprios
// dados numa página pública; a ficha fica aguardando a aprovação do dono, que completa salário e projeto. Nada aqui
// confia em empresa vinda do cliente: o contexto vem da SESSÃO, e a página pública só enxerga o que o token abre.

export interface ContextoConvite {
  empresaId: string;
  nome: string;
}

const UMA_HORA_MS = 60 * 60 * 1000;
const MAX_CONVITES_ABERTOS = 50;
const MENSAGEM_INDISPONIVEL = "Este link não está mais disponível. Peça um novo à empresa.";

function lerDados(json: Prisma.JsonValue | null): DadosCadastroFuncionario | undefined {
  if (!json || typeof json !== "object" || Array.isArray(json)) return undefined;
  const d = json as Record<string, unknown>;
  const texto = (v: unknown) => (typeof v === "string" && v ? v : undefined);
  const nome = texto(d.nome);
  const cargo = texto(d.cargo);
  if (!nome || !cargo) return undefined;
  return { nome, cargo, telefone: texto(d.telefone), email: texto(d.email), cpf: texto(d.cpf) };
}

export async function criarConvite(ctx: ContextoConvite, entrada: unknown, urlBase: string): Promise<ConviteFuncionarioCriado> {
  const parsed = criarConviteFuncionarioSchema.safeParse(entrada ?? {});
  if (!parsed.success) throw new ErroDeNegocio(parsed.error.issues[0]?.message ?? "Dados inválidos.");

  const abertos = await prisma.conviteFuncionario.count({ where: { empresaId: ctx.empresaId, decisao: null, expiraEm: { gt: new Date().toISOString() } } });
  if (abertos >= MAX_CONVITES_ABERTOS) throw new ErroDeNegocio("Há muitos links em aberto. Cancele os que não usar mais.");
  const hoje = await verificarLimite(`convite-func-criar:${ctx.empresaId}`, 60, 24 * UMA_HORA_MS);
  if (!hoje.permitido) throw new ErroDeNegocio("Você gerou muitos links hoje. Tente de novo amanhã.");

  const token = gerarTokenConviteFuncionario();
  const agora = new Date();
  const criado = await prisma.conviteFuncionario.create({
    data: {
      empresaId: ctx.empresaId,
      tokenHash: hashDoToken(token),
      nomeSugerido: parsed.data.nomeSugerido ?? null,
      cargoSugerido: parsed.data.cargoSugerido ?? null,
      criadoPorNome: ctx.nome,
      expiraEm: expiracaoDoConvite(agora),
      criadoEm: agora.toISOString(),
    },
    select: { id: true, expiraEm: true },
  });
  return { id: criado.id, link: linkDoConviteFuncionario(urlBase, token), expiraEm: criado.expiraEm };
}

/** Convites ainda em andamento: aguardando preenchimento, aguardando aprovação e os que venceram sem uso. */
export async function listarConvites(ctx: ContextoConvite): Promise<ConviteFuncionarioItem[]> {
  const linhas = await prisma.conviteFuncionario.findMany({
    where: { empresaId: ctx.empresaId, decisao: null },
    orderBy: [{ criadoEm: "desc" }, { id: "asc" }],
    take: 100,
  });
  const agora = new Date().toISOString();
  return linhas.map((l) => {
    const situacao: SituacaoConviteFuncionario = l.preenchidoEm ? "aguardando_aprovacao" : l.expiraEm <= agora ? "expirado" : "aguardando_preenchimento";
    return {
      id: l.id,
      situacao,
      nomeSugerido: l.nomeSugerido ?? undefined,
      cargoSugerido: l.cargoSugerido ?? undefined,
      criadoEm: l.criadoEm,
      expiraEm: l.expiraEm,
      preenchidoEm: l.preenchidoEm ?? undefined,
      dados: lerDados(l.dados),
    };
  });
}

async function encerrar(ctx: ContextoConvite, id: string, decisao: "recusado" | "cancelado", exigirPreenchido: boolean): Promise<void> {
  if (!idConviteSchema.safeParse(id).success) throw new ErroDeNegocio("Convite não encontrado.");
  const r = await prisma.conviteFuncionario.updateMany({
    where: { id, empresaId: ctx.empresaId, decisao: null, ...(exigirPreenchido ? { preenchidoEm: { not: null } } : {}) },
    // Os dados da pessoa não ficam guardados depois que o convite é encerrado.
    data: { decisao, decididoEm: new Date().toISOString(), dados: Prisma.DbNull },
  });
  if (r.count === 0) throw new ErroDeNegocio("Convite não encontrado ou já decidido.");
}

export const cancelarConvite = (ctx: ContextoConvite, id: string) => encerrar(ctx, id, "cancelado", false);
export const recusarConvite = (ctx: ContextoConvite, id: string) => encerrar(ctx, id, "recusado", true);

/** Aprova: cria a ficha com o que o dono revisou (pode corrigir qualquer campo) e completou (data, projeto, salário). */
export async function aprovarConvite(ctx: ContextoConvite, id: string, entrada: unknown): Promise<Funcionario> {
  if (!idConviteSchema.safeParse(id).success) throw new ErroDeNegocio("Convite não encontrado.");
  const parsed = novoFuncionarioSchema.safeParse(entrada);
  if (!parsed.success) throw new ErroDeNegocio(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  if (parsed.data.obraId) {
    const obra = await prisma.obra.findFirst({ where: { id: parsed.data.obraId, empresaId: ctx.empresaId }, select: { id: true } });
    if (!obra) throw new ErroDeNegocio("Projeto não encontrado.");
  }

  const agora = new Date().toISOString();
  return prisma.$transaction(async (tx) => {
    // Marca primeiro: duas aprovações ao mesmo tempo criariam duas fichas; só a primeira passa deste updateMany.
    const marcado = await tx.conviteFuncionario.updateMany({
      where: { id, empresaId: ctx.empresaId, decisao: null, preenchidoEm: { not: null } },
      data: { decisao: "aprovado", decididoEm: agora, dados: Prisma.DbNull },
    });
    if (marcado.count === 0) throw new ErroDeNegocio("Convite não encontrado ou já decidido.");
    const registro = await tx.funcionario.create({
      data: { ...parsed.data, empresaId: ctx.empresaId, status: "ativo", criadoEm: agora, atualizadoEm: agora },
    });
    await tx.conviteFuncionario.update({ where: { id }, data: { funcionarioId: registro.id } });
    return {
      id: registro.id,
      nome: registro.nome,
      cargo: registro.cargo,
      telefone: registro.telefone ?? undefined,
      email: registro.email ?? undefined,
      cpf: registro.cpf ?? undefined,
      dataAdmissao: registro.dataAdmissao,
      obraId: registro.obraId ?? undefined,
      salario: registro.salario ?? undefined,
      status: "ativo",
      criadoEm: registro.criadoEm,
      atualizadoEm: registro.atualizadoEm,
    };
  });
}

// --- Parte pública (sem sessão) ------------------------------------------------------------------------------------

async function conviteAberto(token: string) {
  if (!tokenConviteFuncionarioValido(token)) return null;
  return prisma.conviteFuncionario.findFirst({
    where: { tokenHash: hashDoToken(token), decisao: null, preenchidoEm: null, expiraEm: { gt: new Date().toISOString() } },
    select: { id: true, nomeSugerido: true, cargoSugerido: true, empresa: { select: { razaoSocial: true, nomeFantasia: true, bloqueadaEm: true } } },
  });
}

export async function obterConvitePublico(token: string, ip: string): Promise<ConvitePublicoFuncionario> {
  // Teto por rede: impede varrer tokens (que de todo modo são impossíveis de adivinhar) e martelar o banco.
  if (ip !== "desconhecido") {
    const l = await verificarLimite(`convite-func-ver:${ip}`, 60, UMA_HORA_MS);
    if (!l.permitido) return { valido: false };
  }
  const c = await conviteAberto(token);
  if (!c || c.empresa.bloqueadaEm) return { valido: false };
  return {
    valido: true,
    empresa: c.empresa.nomeFantasia ?? c.empresa.razaoSocial,
    nomeSugerido: c.nomeSugerido ?? undefined,
    cargoSugerido: c.cargoSugerido ?? undefined,
  };
}

export async function enviarCadastroPublico(token: string, entrada: unknown, ip: string): Promise<void> {
  if (ip !== "desconhecido") {
    const l = await verificarLimite(`convite-func-enviar:${ip}`, 15, UMA_HORA_MS);
    if (!l.permitido) throw new ErroDeNegocio("Muitas tentativas a partir desta rede. Tente de novo mais tarde.");
  }
  const parsed = cadastroPublicoFuncionarioSchema.safeParse(entrada);
  if (!parsed.success) throw new ErroDeNegocio(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  if (!tokenConviteFuncionarioValido(token)) throw new ErroDeNegocio(MENSAGEM_INDISPONIVEL);

  const hash = hashDoToken(token);
  const porLink = await verificarLimite(`convite-func-link:${hash}`, 10, UMA_HORA_MS);
  if (!porLink.permitido) throw new ErroDeNegocio("Muitas tentativas neste link. Tente de novo mais tarde.");

  const { ciente: _ciente, ...dados } = parsed.data;
  void _ciente;
  const agora = new Date().toISOString();
  // Uso único e dentro do prazo na mesma instrução: dois envios simultâneos não passam os dois.
  const r = await prisma.conviteFuncionario.updateMany({
    where: { tokenHash: hash, decisao: null, preenchidoEm: null, expiraEm: { gt: agora }, empresa: { bloqueadaEm: null } },
    data: { dados: dados as Prisma.InputJsonValue, preenchidoEm: agora },
  });
  if (r.count === 0) throw new ErroDeNegocio(MENSAGEM_INDISPONIVEL);
}
