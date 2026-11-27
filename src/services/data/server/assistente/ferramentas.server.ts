import "server-only";
import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { ACESSO, temAlgumModulo, type ModuloChave } from "@/lib/auth/modulos";
import type { ContaFinanceira } from "@/types";
import * as contas from "../contasCore.server";
import type { ContextoContas } from "../contasCore.server";

// Ferramentas que a IA do assistente pode pedir. Cada uma: argumentos validados (zod), módulo exigido (o mesmo do site)
// e execução pelo núcleo da aplicação. A empresa NUNCA vem da IA: sai do número vinculado (ContextoFerramenta).
// Para um módulo novo no assistente, basta acrescentar uma ferramenta aqui.

export interface ContextoFerramenta {
  contas: ContextoContas;
  /** aaaa-mm-dd no fuso da empresa */
  hoje: string;
}

export interface Ferramenta<E extends z.ZodType = z.ZodType> {
  nome: string;
  descricao: string;
  entrada: E;
  /** Basta um destes módulos para usar. */
  modulos: readonly ModuloChave[];
  /** Grava algo? (etapa 3: escrita sempre passa por confirmação do sistema, nunca direto). */
  escrita: boolean;
  executar(ctx: ContextoFerramenta, args: z.infer<E>): Promise<ResultadoFerramenta>;
}

export interface ResultadoFerramenta {
  dados: unknown;
  /** Contas citadas, para lembrar "aquela conta" na próxima mensagem (só a referência curta e um rótulo). */
  citadas?: ContaCitada[];
}

export interface ContaCitada {
  ref: string;
  rotulo: string;
}

/** Só para inferir os tipos dos argumentos a partir do esquema zod. */
const ferramenta = <E extends z.ZodType>(f: Ferramenta<E>): Ferramenta<E> => f;

const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "use aaaa-mm-dd");
const LER_CONTAS = [...ACESSO.contasPagarLer, ...ACESSO.contasReceberLer] as const;
const MAX_NA_RESPOSTA = 15;

/** Referência curta da conta (8 primeiros caracteres do id): estável, sem expor nada além da própria empresa. */
export const refDaConta = (id: string) => id.slice(0, 8);

const real = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function resumoDaConta(c: ContaFinanceira, hoje: string) {
  return {
    ref: refDaConta(c.id),
    tipo: c.tipo === "pagar" ? "a pagar" : "a receber",
    favorecido: c.favorecidoOuCliente,
    descricao: c.descricao,
    valor: c.valor,
    vencimento: c.dataVencimento,
    situacao: c.status === "em_aberto" ? (c.dataVencimento < hoje ? "atrasada" : "em aberto") : c.status === "baixada" ? (c.tipo === "pagar" ? "paga" : "recebida") : "cancelada",
    baixadaEm: c.dataBaixa ?? null,
    categoria: c.categoria ?? null,
    parcela: c.parcela ? `${c.parcela.numero}/${c.parcela.totalParcelas}` : null,
  };
}

const citar = (c: ContaFinanceira): ContaCitada => ({ ref: refDaConta(c.id), rotulo: `${c.favorecidoOuCliente} · ${real(c.valor)} · vence ${c.dataVencimento}` });

const listarContas = ferramenta({
  nome: "listar_contas",
  descricao:
    "Lista contas a pagar e/ou a receber da empresa com totais. Use para: o que vence hoje/na semana, atrasadas, o que foi pago num período, procurar uma conta pelo nome (busca). " +
    "Período (de/ate): para em_aberto e atrasadas vale a data de vencimento; para pagas, a data em que foi paga/recebida. Devolve no máximo 15 contas, mais o total e a quantidade de todas que batem.",
  entrada: z
    .object({
      tipo: z.enum(["pagar", "receber"]).optional().describe("Sem tipo: os dois."),
      situacao: z.enum(["em_aberto", "atrasadas", "pagas", "canceladas", "todas"]).default("em_aberto"),
      de: data.optional().describe("Início do período, aaaa-mm-dd"),
      ate: data.optional().describe("Fim do período, aaaa-mm-dd"),
      busca: z.string().trim().min(2).max(80).optional().describe("Parte do nome do favorecido/cliente ou da descrição, ex.: internet, aluguel"),
      ordenar: z.enum(["vencimento", "maior_valor"]).default("vencimento"),
    })
    .strict(),
  modulos: LER_CONTAS,
  escrita: false,
  async executar(ctx, a) {
    const status = a.situacao === "pagas" ? "baixada" : a.situacao === "canceladas" ? "cancelada" : a.situacao === "todas" ? undefined : "em_aberto";
    let ate = a.ate;
    if (a.situacao === "atrasadas") {
      const ontem = new Date(`${ctx.hoje}T12:00:00Z`);
      ontem.setUTCDate(ontem.getUTCDate() - 1);
      const limite = ontem.toISOString().slice(0, 10);
      ate = !ate || ate > limite ? limite : ate;
    }
    const lista = await contas.listarContas(ctx.contas, {
      tipo: a.tipo,
      status,
      dataInicio: a.de,
      dataFim: ate,
      busca: a.busca,
      porData: a.situacao === "pagas" ? "baixa" : "vencimento",
      limite: 500,
    });
    const ordenada = [...lista].sort((x, y) => (a.ordenar === "maior_valor" ? y.valor - x.valor : x.dataVencimento.localeCompare(y.dataVencimento)));
    const mostradas = ordenada.slice(0, MAX_NA_RESPOSTA);
    return {
      dados: {
        quantidade: lista.length,
        total: Math.round(lista.reduce((s, c) => s + c.valor, 0) * 100) / 100,
        maisDe500: lista.length >= 500,
        mostrando: mostradas.length,
        contas: mostradas.map((c) => resumoDaConta(c, ctx.hoje)),
      },
      citadas: mostradas.map(citar),
    };
  },
});

const resumoFinanceiro = ferramenta({
  nome: "resumo_financeiro",
  descricao:
    "Totais de um período: quanto foi pago (saídas) e recebido (entradas, o faturamento recebido) pela data da baixa, o que vence no período e segue em aberto, o que está atrasado (vencido antes de hoje, de qualquer data), o resultado (recebido − pago) e o pago por categoria. " +
    "Use para: quanto gastei, quanto faturei, resumo do dia/semana/mês, comparar meses (chame uma vez por mês). O Elo não tem saldo bancário: 'caixa' aqui é recebido − pago no período.",
  entrada: z.object({ de: data, ate: data }).strict(),
  modulos: LER_CONTAS,
  escrita: false,
  async executar(ctx, a) {
    const r = await contas.resumoFinanceiro(ctx.contas, a.de, a.ate, ctx.hoje);
    const resultado = r.pago && r.recebido ? Math.round((r.recebido.total - r.pago.total) * 100) / 100 : null;
    return { dados: { ...r, resultadoRecebidoMenosPago: resultado } };
  },
});

const detalharConta = ferramenta({
  nome: "detalhar_conta",
  descricao: "Detalhes de uma conta já citada na conversa, pela referência curta (ref) devolvida por listar_contas.",
  entrada: z.object({ ref: z.string().trim().regex(/^[0-9a-f]{8}$/i, "ref de 8 caracteres") }).strict(),
  modulos: LER_CONTAS,
  escrita: false,
  async executar(ctx, a) {
    const conta = await contaPelaRef(ctx.contas, a.ref);
    if (!conta) return { dados: { erro: "Conta não encontrada com essa referência." } };
    return {
      dados: { ...resumoDaConta(conta, ctx.hoje), observacao: conta.observacao ?? null, formaPagamento: conta.formaPagamento ?? null, historico: conta.historico.slice(-5).map((h) => ({ tipo: h.tipo, por: h.usuario, em: h.data.slice(0, 10) })) },
      citadas: [citar(conta)],
    };
  },
});

/** Acha a conta da empresa pela referência curta; ambígua ou de tipo sem acesso devolve null. */
export async function contaPelaRef(ctx: ContextoContas, ref: string): Promise<ContaFinanceira | null> {
  const achadas = await prisma.contaFinanceira.findMany({ where: { empresaId: ctx.empresaId, id: { startsWith: ref.toLowerCase() } }, select: { id: true }, take: 2 });
  if (achadas.length !== 1) return null;
  return contas.obterContaPorId(ctx, achadas[0].id);
}

export const FERRAMENTAS: readonly Ferramenta[] = [listarContas, resumoFinanceiro, detalharConta] as readonly Ferramenta[];

/** Só as ferramentas que a pessoa pode usar vão para a IA (quem não vê contas nem fica sabendo que elas existem). */
export function ferramentasDaPessoa(ctx: ContextoContas): Ferramenta[] {
  return FERRAMENTAS.filter((f) => temAlgumModulo(ctx, f.modulos));
}

export function definicaoParaIA(f: Ferramenta): Anthropic.Beta.BetaTool {
  const esquema = z.toJSONSchema(f.entrada, { io: "input" }) as Record<string, unknown>;
  delete esquema.$schema;
  return { name: f.nome, description: f.descricao, input_schema: esquema as Anthropic.Beta.BetaTool.InputSchema };
}
