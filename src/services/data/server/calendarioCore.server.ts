import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { agendarLembretes, planejarReagendamento, type LembreteExistente } from "@/lib/calendario/lembretes";
import { fusoPermitido } from "@/lib/calendario/config";
import { podeAlterar, podeVer } from "@/lib/calendario/permissoes";
import { dataLocal, periodoDoCompromisso } from "@/lib/calendario/tempo";
import { compromissoSchema } from "@/lib/validacao/calendario";
import type { CompromissoItem, ColegaItem, EntradaCompromisso, ListaCompromissos, PreferenciasCalendario } from "@/types";
import { ErroDeNegocio } from "./resultado.server";

// Regras de negócio do calendário. Recebe sempre o contexto (usuário e empresa) que veio da SESSÃO: nada aqui
// confia em identificador enviado pelo cliente. Compartilhado entre as Server Actions e os testes.

export interface Contexto {
  usuarioId: string;
  empresaId: string;
}

const NAO_ENCONTRADO = "Compromisso não encontrado.";

const incluirRelacoes = {
  criadoPor: { select: { id: true, nome: true } },
  participantes: { select: { usuario: { select: { id: true, nome: true } } } },
} satisfies Prisma.CompromissoInclude;

type CompromissoComRelacoes = Prisma.CompromissoGetPayload<{ include: typeof incluirRelacoes }>;

function paraItem(c: CompromissoComRelacoes, ctx: Contexto): CompromissoItem {
  return {
    id: c.id,
    titulo: c.titulo,
    descricao: c.descricao ?? undefined,
    categoria: c.categoria,
    status: c.status,
    data: c.data,
    diaInteiro: c.diaInteiro,
    horaInicio: c.horaInicio ?? undefined,
    horaFim: c.horaFim ?? undefined,
    criadoPor: { id: c.criadoPor.id, nome: c.criadoPor.nome },
    participantes: c.participantes.map((p) => ({ id: p.usuario.id, nome: p.usuario.nome })),
    souCriador: c.criadoPorId === ctx.usuarioId,
  };
}

/** Visível ao usuário: ele criou ou foi incluído. Nunca por pertencer à mesma empresa. */
function visivelPara(ctx: Contexto): Prisma.CompromissoWhereInput {
  return {
    empresaId: ctx.empresaId,
    OR: [{ criadoPorId: ctx.usuarioId }, { participantes: { some: { usuarioId: ctx.usuarioId } } }],
  };
}

async function fusoDaEmpresa(empresaId: string): Promise<string> {
  const empresa = await prisma.empresa.findUnique({ where: { id: empresaId }, select: { fusoHorario: true } });
  return empresa?.fusoHorario ?? "America/Sao_Paulo";
}

/** A data de hoje no fuso da empresa (a página usa para abrir o calendário no dia certo). */
export async function hojeDaEmpresa(ctx: Contexto, agora: Date = new Date()): Promise<string> {
  return dataLocal(agora, await fusoDaEmpresa(ctx.empresaId));
}

export async function listarNoPeriodo(ctx: Contexto, de: string, ate: string, agora: Date = new Date()): Promise<ListaCompromissos> {
  const fuso = await fusoDaEmpresa(ctx.empresaId);
  const registros = await prisma.compromisso.findMany({
    where: { ...visivelPara(ctx), data: { gte: de, lte: ate } },
    include: incluirRelacoes,
    orderBy: [{ data: "asc" }, { horaInicio: { sort: "asc", nulls: "first" } }, { titulo: "asc" }, { id: "asc" }],
    take: 500,
  });
  return { hoje: dataLocal(agora, fuso), fuso, itens: registros.map((c) => paraItem(c, ctx)) };
}

export async function listarProximos(ctx: Contexto, limite: number, agora: Date = new Date()): Promise<CompromissoItem[]> {
  const registros = await prisma.compromisso.findMany({
    where: { ...visivelPara(ctx), status: "agendado", fimEm: { gte: agora.toISOString() } },
    include: incluirRelacoes,
    orderBy: [{ inicioEm: "asc" }, { id: "asc" }],
    take: Math.min(Math.max(limite, 1), 20),
  });
  return registros.map((c) => paraItem(c, ctx));
}

/** Mesmo erro para "não existe" e "sem acesso": o identificador não serve para sondar compromissos alheios. */
export async function obterUm(ctx: Contexto, id: string): Promise<CompromissoItem> {
  const c = await prisma.compromisso.findFirst({ where: { id, ...visivelPara(ctx) }, include: incluirRelacoes });
  if (!c) throw new ErroDeNegocio(NAO_ENCONTRADO);
  return paraItem(c, ctx);
}

/** Usuários ativos da mesma empresa, para escolher com quem compartilhar. */
export async function listarColegas(ctx: Contexto): Promise<ColegaItem[]> {
  return prisma.usuario.findMany({
    where: { empresaId: ctx.empresaId, id: { not: ctx.usuarioId }, desativadoEm: null, bloqueadoPlataformaEm: null },
    select: { id: true, nome: true, email: true },
    orderBy: [{ nome: "asc" }, { id: "asc" }],
    take: 100,
  });
}

type Tx = Prisma.TransactionClient;

/** Participantes precisam ser usuários ativos desta empresa; o criador não entra na lista. */
async function validarParticipantes(db: Tx | typeof prisma, ctx: Contexto, ids: string[]): Promise<string[]> {
  const unicos = [...new Set(ids)].filter((id) => id !== ctx.usuarioId);
  if (unicos.length === 0) return [];
  const validos = await db.usuario.count({
    where: { id: { in: unicos }, empresaId: ctx.empresaId, desativadoEm: null, bloqueadoPlataformaEm: null },
  });
  if (validos !== unicos.length) throw new ErroDeNegocio("Só é possível compartilhar com usuários ativos da sua empresa.");
  return unicos;
}

function validarEntrada(entrada: unknown) {
  const parsed = compromissoSchema.safeParse(entrada);
  if (!parsed.success) throw new ErroDeNegocio(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  return parsed.data;
}

/** Cria, atualiza ou ignora os lembretes conforme o estado atual do compromisso. Rodar dentro da transação. */
export async function sincronizarLembretes(
  tx: Tx,
  c: { id: string; data: string; diaInteiro: boolean; horaInicio: string | null; fuso: string; inicioEm: string; status: string },
  agora: Date,
): Promise<void> {
  const existentes = await tx.lembreteCompromisso.findMany({ where: { compromissoId: c.id } });
  const iso = agora.toISOString();

  if (c.status !== "agendado") {
    // Cancelado ou concluído: nada mais deve sair, nem os já reservados nem as entregas à espera de nova tentativa.
    await tx.lembreteCompromisso.updateMany({
      where: { compromissoId: c.id, status: { in: ["pendente", "processando"] } },
      data: { status: "ignorado", travadoAte: null, atualizadoEm: iso },
    });
    await tx.entregaLembrete.updateMany({
      where: { lembrete: { compromissoId: c.id }, status: "pendente" },
      data: { status: "ignorada", atualizadoEm: iso },
    });
    return;
  }

  const atuais: LembreteExistente[] = existentes.map((e) => ({ tipo: e.tipo, disparoEm: e.disparoEm, status: e.status, versao: e.versao }));
  const acoes = planejarReagendamento(atuais, agendarLembretes(c, agora));
  for (const acao of acoes) {
    if (acao.acao === "criar") {
      await tx.lembreteCompromisso.create({
        data: { compromissoId: c.id, tipo: acao.tipo, disparoEm: acao.disparoEm, versao: 1, criadoEm: iso, atualizadoEm: iso },
      });
    } else if (acao.acao === "atualizar") {
      await tx.lembreteCompromisso.update({
        where: { compromissoId_tipo: { compromissoId: c.id, tipo: acao.tipo } },
        data: { disparoEm: acao.disparoEm, versao: acao.versao, status: "pendente", travadoAte: null, processadoEm: null, atualizadoEm: iso },
      });
      // Entregas à espera de nova tentativa da versão anterior ficam obsoletas.
      await tx.entregaLembrete.updateMany({
        where: { lembrete: { compromissoId: c.id, tipo: acao.tipo }, status: "pendente", versao: { lt: acao.versao } },
        data: { status: "ignorada", atualizadoEm: iso },
      });
    } else if (acao.acao === "ignorar") {
      await tx.lembreteCompromisso.update({
        where: { compromissoId_tipo: { compromissoId: c.id, tipo: acao.tipo } },
        data: { status: "ignorado", travadoAte: null, atualizadoEm: iso },
      });
    }
  }
}

export async function criar(ctx: Contexto, entrada: EntradaCompromisso | unknown, agora: Date = new Date()): Promise<CompromissoItem> {
  const dados = validarEntrada(entrada);
  const fuso = await fusoDaEmpresa(ctx.empresaId);
  const periodo = periodoDoCompromisso(dados, fuso);
  const iso = agora.toISOString();

  const id = await prisma.$transaction(async (tx) => {
    const participantes = await validarParticipantes(tx, ctx, dados.participantesIds);
    const c = await tx.compromisso.create({
      data: {
        empresaId: ctx.empresaId,
        criadoPorId: ctx.usuarioId,
        titulo: dados.titulo,
        descricao: dados.descricao || null,
        categoria: dados.categoria,
        status: dados.status,
        data: dados.data,
        diaInteiro: dados.diaInteiro,
        horaInicio: dados.diaInteiro ? null : (dados.horaInicio ?? null),
        horaFim: dados.diaInteiro ? null : (dados.horaFim ?? null),
        fuso,
        inicioEm: periodo.inicioEm,
        fimEm: periodo.fimEm,
        criadoEm: iso,
        atualizadoEm: iso,
        participantes: { create: participantes.map((usuarioId) => ({ usuarioId, criadoEm: iso })) },
      },
    });
    await sincronizarLembretes(tx, c, agora);
    return c.id;
  });
  return obterUm(ctx, id);
}

/** Carrega para alterar: sem acesso vira "não encontrado"; com acesso mas sem ser o criador, recusa com motivo. */
async function carregarParaAlterar(ctx: Contexto, id: string) {
  const c = await prisma.compromisso.findFirst({
    where: { id, empresaId: ctx.empresaId },
    include: { participantes: { select: { usuarioId: true } } },
  });
  const acesso = c ? { empresaId: c.empresaId, criadoPorId: c.criadoPorId, participantesIds: c.participantes.map((p) => p.usuarioId) } : null;
  if (!c || !acesso || !podeVer(acesso, ctx)) throw new ErroDeNegocio(NAO_ENCONTRADO);
  if (!podeAlterar(acesso, ctx)) throw new ErroDeNegocio("Só quem criou o compromisso pode alterá-lo.");
  return c;
}

export async function atualizar(ctx: Contexto, id: string, entrada: EntradaCompromisso | unknown, agora: Date = new Date()): Promise<CompromissoItem> {
  const dados = validarEntrada(entrada);
  const atual = await carregarParaAlterar(ctx, id);
  const fuso = await fusoDaEmpresa(ctx.empresaId);
  const periodo = periodoDoCompromisso(dados, fuso);
  const iso = agora.toISOString();

  await prisma.$transaction(async (tx) => {
    const novos = await validarParticipantes(tx, ctx, dados.participantesIds);
    const antes = atual.participantes.map((p) => p.usuarioId);
    const removidos = antes.filter((u) => !novos.includes(u));
    const adicionados = novos.filter((u) => !antes.includes(u));

    const c = await tx.compromisso.update({
      where: { id: atual.id },
      data: {
        titulo: dados.titulo,
        descricao: dados.descricao || null,
        categoria: dados.categoria,
        status: dados.status,
        data: dados.data,
        diaInteiro: dados.diaInteiro,
        horaInicio: dados.diaInteiro ? null : (dados.horaInicio ?? null),
        horaFim: dados.diaInteiro ? null : (dados.horaFim ?? null),
        fuso,
        inicioEm: periodo.inicioEm,
        fimEm: periodo.fimEm,
        atualizadoEm: iso,
      },
    });
    if (removidos.length > 0) {
      await tx.compromissoParticipante.deleteMany({ where: { compromissoId: atual.id, usuarioId: { in: removidos } } });
      // Quem perdeu o acesso não guarda avisos que apontam para o compromisso.
      await tx.notificacao.deleteMany({ where: { compromissoId: atual.id, usuarioId: { in: removidos } } });
      await tx.entregaLembrete.updateMany({
        where: { lembrete: { compromissoId: atual.id }, usuarioId: { in: removidos }, status: "pendente" },
        data: { status: "ignorada", atualizadoEm: iso },
      });
    }
    if (adicionados.length > 0) {
      await tx.compromissoParticipante.createMany({ data: adicionados.map((usuarioId) => ({ compromissoId: atual.id, usuarioId, criadoEm: iso })), skipDuplicates: true });
    }
    await sincronizarLembretes(tx, c, agora);
  });
  return obterUm(ctx, id);
}

export async function excluir(ctx: Contexto, id: string): Promise<void> {
  const c = await carregarParaAlterar(ctx, id);
  // Lembretes e entregas saem em cascata; as notificações já entregues ficam, sem o vínculo.
  await prisma.compromisso.delete({ where: { id: c.id } });
}

// --- Preferências -----------------------------------------------------------

export async function obterPreferencias(ctx: Contexto, papel: "dono" | "membro"): Promise<PreferenciasCalendario> {
  const [usuario, empresa] = await Promise.all([
    prisma.usuario.findUnique({ where: { id: ctx.usuarioId }, select: { lembretesPorEmail: true, lembretesNoApp: true } }),
    prisma.empresa.findUnique({ where: { id: ctx.empresaId }, select: { fusoHorario: true } }),
  ]);
  return {
    lembretesPorEmail: usuario?.lembretesPorEmail ?? true,
    lembretesNoApp: usuario?.lembretesNoApp ?? true,
    fusoHorario: empresa?.fusoHorario ?? "America/Sao_Paulo",
    podeAlterarFuso: papel === "dono",
  };
}

export async function salvarPreferencias(ctx: Contexto, prefs: { lembretesPorEmail: boolean; lembretesNoApp: boolean }): Promise<void> {
  await prisma.usuario.update({
    where: { id: ctx.usuarioId },
    data: { lembretesPorEmail: prefs.lembretesPorEmail, lembretesNoApp: prefs.lembretesNoApp, atualizadoEm: new Date().toISOString() },
  });
}

export async function salvarFuso(ctx: Contexto, papel: "dono" | "membro", fuso: string): Promise<void> {
  if (papel !== "dono") throw new Error("SEM_PERMISSAO");
  if (!fusoPermitido(fuso)) throw new ErroDeNegocio("Fuso horário inválido.");
  await prisma.empresa.update({ where: { id: ctx.empresaId }, data: { fusoHorario: fuso, atualizadoEm: new Date().toISOString() } });
}
