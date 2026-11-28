import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ACESSO } from "@/lib/auth/modulos";
import { CATEGORIAS } from "@/lib/calendario/categorias";
import { configLembretes } from "@/lib/calendario/config";
import { MAX_AVISO_MINUTOS } from "@/lib/calendario/lembretes";
import { ehHoraValida, periodoDoCompromisso } from "@/lib/calendario/tempo";
import { urlDoSite } from "@/lib/rede/site";
import type { CompromissoItem } from "@/types";
import * as calendario from "../calendarioCore.server";
import { data, ferramenta, PedidoIncompleto, type ContaCitada, type ContextoFerramenta, type Ferramenta } from "./ferramentas.server";

// Calendário e lembretes pelo assistente, pelas MESMAS regras do app (calendarioCore: só vê o que criou ou foi
// compartilhado com a pessoa; só quem criou altera). Lembretes são da própria pessoa e reversíveis no app, então são
// gravados direto, sem o SIM (dinheiro sempre pede SIM).

const CALENDARIO = ACESSO.calendario;
const hora = z.string().trim().refine(ehHoraValida, "use HH:mm");
const refCompromisso = z.string().trim().regex(/^[0-9a-f]{8}$/i, "ref de 8 caracteres de um compromisso citado");

const ctxCalendario = (ctx: ContextoFerramenta): calendario.Contexto => ({ usuarioId: ctx.usuarioId, empresaId: ctx.contas.empresaId });
const dataBr = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
const quando = (c: Pick<CompromissoItem, "data" | "diaInteiro" | "horaInicio">) => `${dataBr(c.data)}${c.diaInteiro ? " (dia inteiro)" : ` às ${c.horaInicio}`}`;
export const refDoCompromisso = (id: string) => id.slice(0, 8);
const citar = (c: CompromissoItem): ContaCitada => ({ ref: refDoCompromisso(c.id), rotulo: `compromisso ${c.titulo} · ${quando(c)}` });
const link = (id: string) => `${urlDoSite()}/calendario?evento=${id}`;

function resumo(c: CompromissoItem) {
  return {
    ref: refDoCompromisso(c.id),
    titulo: c.titulo,
    data: c.data,
    hora: c.diaInteiro ? null : (c.horaInicio ?? null),
    fim: c.horaFim ?? null,
    status: c.status,
    avisoMinutosAntes: c.avisoMinutosAntes ?? null,
    criadoPorMim: c.souCriador,
    criadoPor: c.souCriador ? null : c.criadoPor.nome,
  };
}

/** Compromisso visível à pessoa pela ref curta. Ambíguo, de outra empresa ou não compartilhado: não encontrado. */
async function compromissoPelaRef(ctx: ContextoFerramenta, ref: string): Promise<CompromissoItem> {
  const achados = await prisma.compromisso.findMany({ where: { empresaId: ctx.contas.empresaId, id: { startsWith: ref.toLowerCase() } }, select: { id: true }, take: 2 });
  if (achados.length !== 1) throw new PedidoIncompleto("Compromisso não encontrado com essa ref. Procure de novo com listar_compromissos.");
  try {
    return await calendario.obterUm(ctxCalendario(ctx), achados[0].id);
  } catch {
    throw new PedidoIncompleto("Compromisso não encontrado com essa ref. Procure de novo com listar_compromissos.");
  }
}

/** Por onde os lembretes da pessoa saem hoje (preferências reais), para a resposta não chutar. */
async function canaisDeAviso(usuarioId: string): Promise<string[]> {
  const u = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { lembretesNoApp: true, lembretesPorEmail: true, vinculoWhatsapp: { select: { verificadoEm: true, lembretesAtivos: true } } },
  });
  if (!u) return [];
  return [
    ...(u.vinculoWhatsapp?.verificadoEm && u.vinculoWhatsapp.lembretesAtivos ? ["WhatsApp"] : []),
    ...(u.lembretesNoApp ? ["app"] : []),
    ...(u.lembretesPorEmail ? ["e-mail"] : []),
  ];
}

/** Reaproveita a edição do app: manda o compromisso inteiro de volta, mudando só o que foi pedido. */
function entradaDe(c: CompromissoItem, mudancas: Record<string, unknown>) {
  return {
    titulo: c.titulo,
    descricao: c.descricao,
    categoria: c.categoria,
    data: c.data,
    diaInteiro: c.diaInteiro,
    horaInicio: c.horaInicio,
    horaFim: c.horaFim,
    status: c.status,
    participantesIds: c.participantes.map((p) => p.id),
    ...mudancas,
  };
}

const listarCompromissos = ferramenta({
  nome: "listar_compromissos",
  descricao:
    "Lista compromissos e lembretes do calendário da pessoa (os que ela criou ou que compartilharam com ela) num período de até 60 dias. Use para: meus lembretes de hoje, agenda da semana, achar um compromisso para mudar o aviso ou cancelar.",
  entrada: z.object({ de: data, ate: data, incluir_cancelados: z.boolean().default(false) }).strict(),
  modulos: CALENDARIO,
  async executar(ctx, a) {
    if (a.ate < a.de) throw new PedidoIncompleto("O fim do período vem antes do início.");
    const dias = (Date.parse(`${a.ate}T12:00:00Z`) - Date.parse(`${a.de}T12:00:00Z`)) / 86_400_000;
    if (dias > 60) throw new PedidoIncompleto("Período grande demais: use no máximo 60 dias.");
    const lista = await calendario.listarNoPeriodo(ctxCalendario(ctx), a.de, a.ate);
    const itens = lista.itens.filter((c) => a.incluir_cancelados || c.status !== "cancelado");
    const mostrados = itens.slice(0, 20);
    return { dados: { quantidade: itens.length, mostrando: mostrados.length, compromissos: mostrados.map(resumo) }, citadas: mostrados.map(citar) };
  },
});

const criarLembrete = ferramenta({
  nome: "criar_lembrete",
  descricao:
    "Cria um lembrete na agenda da pessoa (vale para 'me lembra amanhã às 9h de pagar a internet' e para marcar um compromisso, ex.: reunião na sexta às 15h). GRAVA na hora (é da própria pessoa e dá para desfazer). " +
    "O aviso sai pelos canais de lembrete dela (WhatsApp, app, e-mail, conforme as preferências). Sem hora: o dia inteiro, avisando às 9h. minutos_antes: antecedência do aviso (0 = na hora).",
  entrada: z
    .object({
      titulo: z.string().trim().min(1).max(120).describe("Curto, ex.: Pagar a internet, Reunião com o cliente Souza"),
      data,
      hora: hora.optional().describe("HH:mm, horário local"),
      minutos_antes: z.number().int().min(0).max(MAX_AVISO_MINUTOS).default(0),
      categoria: z.enum(CATEGORIAS).default("pessoal").describe("financeiro para pagar/receber; reuniao, visita, prazo, pessoal, outro"),
      descricao: z.string().trim().max(500).optional(),
      somente_aviso: z.boolean().default(true).describe("true: só o aviso pedido (lembrete simples). false: compromisso normal, que também avisa na véspera e no dia."),
    })
    .strict(),
  modulos: CALENDARIO,
  async executar(ctx, a) {
    const diaInteiro = !a.hora;
    const fuso = (await prisma.empresa.findUnique({ where: { id: ctx.contas.empresaId }, select: { fusoHorario: true } }))?.fusoHorario ?? "America/Sao_Paulo";
    const inicio = periodoDoCompromisso({ data: a.data, diaInteiro, horaInicio: a.hora }, fuso).inicioEm;
    // Em dia inteiro o aviso sai na hora padrão (9h); com hora, no horário pedido menos a antecedência.
    const aviso = diaInteiro ? Date.parse(inicio) + configLembretes().horaDiaInteiro * 3_600_000 - a.minutos_antes * 60_000 : Date.parse(inicio) - a.minutos_antes * 60_000;
    if (aviso <= Date.now()) throw new PedidoIncompleto("Esse horário de aviso já passou. Pergunte ao usuário outro horário.");
    const c = await calendario.criar(ctxCalendario(ctx), {
      titulo: a.titulo,
      descricao: a.descricao,
      categoria: a.categoria,
      data: a.data,
      diaInteiro,
      horaInicio: a.hora,
      status: "agendado",
      participantesIds: [],
      avisoMinutosAntes: a.minutos_antes,
      lembretesPadrao: !a.somente_aviso,
    });
    return {
      dados: { criado: true, ...resumo(c), avisaPor: await canaisDeAviso(ctx.usuarioId), link: link(c.id) },
      citadas: [citar(c)],
      registroId: c.id,
    };
  },
});

const avisarAntes = ferramenta({
  nome: "avisar_antes",
  descricao: "Define (ou muda) um aviso X minutos antes de um compromisso já existente, pela ref (ex.: 'me avisa 30 minutos antes dessa reunião'). Grava na hora. minutos null tira o aviso extra.",
  entrada: z.object({ ref: refCompromisso, minutos: z.number().int().min(0).max(MAX_AVISO_MINUTOS).nullable() }).strict(),
  modulos: CALENDARIO,
  async executar(ctx, a) {
    const atual = await compromissoPelaRef(ctx, a.ref);
    if (!atual.souCriador) throw new PedidoIncompleto(`Só quem criou o compromisso pode mudar o aviso (foi ${atual.criadoPor.nome}).`);
    if (atual.status !== "agendado") throw new PedidoIncompleto("Esse compromisso não está mais agendado.");
    const c = await calendario.atualizar(ctxCalendario(ctx), atual.id, entradaDe(atual, { avisoMinutosAntes: a.minutos }));
    return { dados: { alterado: true, ...resumo(c) }, citadas: [citar(c)], registroId: c.id };
  },
});

const cancelarCompromisso = ferramenta({
  nome: "cancelar_compromisso",
  descricao: "Cancela um lembrete ou compromisso pela ref (fica como cancelado no app, sem apagar; os avisos param). Grava na hora. Só quem criou pode cancelar.",
  entrada: z.object({ ref: refCompromisso }).strict(),
  modulos: CALENDARIO,
  async executar(ctx, a) {
    const atual = await compromissoPelaRef(ctx, a.ref);
    if (!atual.souCriador) throw new PedidoIncompleto(`Só quem criou pode cancelar (foi ${atual.criadoPor.nome}).`);
    if (atual.status === "cancelado") return { dados: { jaEstavaCancelado: true, ...resumo(atual) } };
    const c = await calendario.atualizar(ctxCalendario(ctx), atual.id, entradaDe(atual, { status: "cancelado" }));
    return { dados: { cancelado: true, ...resumo(c) }, citadas: [citar(c)], registroId: c.id };
  },
});

export const FERRAMENTAS_DE_CALENDARIO: readonly Ferramenta[] = [listarCompromissos, criarLembrete, avisarAntes, cancelarCompromisso] as readonly Ferramenta[];
