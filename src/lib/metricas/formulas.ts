// Fórmulas do painel de métricas. Funções puras: o que cada número significa fica aqui, num lugar só, e é o mesmo texto
// que o painel mostra ao administrador. Nada é estimado: onde não há dado (ofertas, abertura de e-mail, receita) o
// painel diz que não mede, em vez de mostrar zero.

import { DIA_MS } from "@/lib/cicloDeVida/datas";
import type { RetencaoSemana } from "@/types";

export const PERIODOS_METRICAS = [7, 30, 90] as const;
export type PeriodoMetricas = (typeof PERIODOS_METRICAS)[number];

export function periodoValido(valor: unknown): valor is PeriodoMetricas {
  return typeof valor === "number" && (PERIODOS_METRICAS as readonly number[]).includes(valor);
}

/** Abaixo disto a porcentagem engana: 1 de 3 parece 33%. O painel avisa em vez de esconder. */
export const AMOSTRA_MINIMA = 20;

/** Parte sobre o total, de 0 a 1. Sem total não existe taxa (null), nunca 0%. */
export function taxa(parte: number, total: number): number | null {
  if (!Number.isFinite(parte) || !Number.isFinite(total) || total <= 0) return null;
  return Math.min(1, Math.max(0, parte / total));
}

export function formatarTaxa(t: number | null): string {
  if (t === null) return "—";
  const pct = t * 100;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(1).replace(".", ",")}%`;
}

export interface SinaisDeAtivacao {
  contas: number;
  obras: number;
  produtos: number;
  compromissos: number;
  perfilPublicado: boolean;
}

/** Ativada = fez ao menos uma coisa de verdade no sistema (os mesmos fatos do checklist), não só entrou. */
export function empresaAtivada(s: SinaisDeAtivacao): boolean {
  return s.contas > 0 || s.obras > 0 || s.produtos > 0 || s.compromissos > 0 || s.perfilPublicado;
}

export interface SituacaoDoTeste {
  plano: string;
  testeTerminaEm: string | null;
}

/** O prazo do teste já passou ou a conta já mudou de plano: só estes entram na taxa de conversão. */
export function testeAmadurecido(e: SituacaoDoTeste, agora: Date): boolean {
  if (e.plano !== "teste") return true;
  return e.testeTerminaEm !== null && new Date(e.testeTerminaEm).getTime() <= agora.getTime();
}

/** Convertida = plano "ativo". Cortesia é decisão da administração, não conversão. */
export function testeConvertido(e: SituacaoDoTeste): boolean {
  return e.plano === "ativo";
}

/** Semanas acompanhadas na retenção: da 1ª (os 7 primeiros dias) à 4ª (dias 22 a 28). */
export const SEMANAS_RETENCAO = 4;
const SEMANA_MS = 7 * DIA_MS;

/** Semana depois do cadastro em que caiu o instante (1 = os 7 primeiros dias); null se for antes do cadastro ou data inválida. */
export function semanaDoCadastro(cadastro: string, instante: string): number | null {
  const decorrido = Date.parse(instante) - Date.parse(cadastro);
  if (!Number.isFinite(decorrido) || decorrido < 0) return null;
  return Math.floor(decorrido / SEMANA_MS) + 1;
}

/** Datas das ações gravadas no histórico de uma conta (criação, edição, baixa, cancelamento). Ignora o que não for data. */
export function datasDoHistorico(historico: unknown): string[] {
  if (!Array.isArray(historico)) return [];
  return historico.flatMap((ev: unknown) => {
    const data = ev && typeof ev === "object" ? (ev as { data?: unknown }).data : undefined;
    return typeof data === "string" ? [data] : [];
  });
}

/**
 * Retenção por coorte. Na semana N entram só as empresas cujo cadastro já completou N semanas (a base), e delas as que
 * registraram alguma ação naquela semana. Assim, empresa recém-criada não puxa a taxa para baixo por falta de tempo.
 */
export function retencaoSemanal(
  empresas: readonly { id: string; criadoEm: string }[],
  atividades: readonly { empresaId: string; em: string }[],
  agora: Date,
  semanas: number = SEMANAS_RETENCAO,
): RetencaoSemana[] {
  const cadastroPorId = new Map(empresas.map((e) => [e.id, e.criadoEm]));
  const ativasNaSemana = new Set<string>();
  for (const a of atividades) {
    const cadastro = cadastroPorId.get(a.empresaId);
    if (cadastro === undefined) continue;
    const semana = semanaDoCadastro(cadastro, a.em);
    if (semana !== null && semana <= semanas) ativasNaSemana.add(`${a.empresaId}:${semana}`);
  }
  return Array.from({ length: semanas }, (_, i) => {
    const semana = i + 1;
    const maduras = empresas.filter((e) => agora.getTime() - Date.parse(e.criadoEm) >= semana * SEMANA_MS);
    return { semana, base: maduras.length, retidas: maduras.filter((e) => ativasNaSemana.has(`${e.id}:${semana}`)).length };
  });
}

export interface FormulaMetrica {
  id: string;
  nome: string;
  formula: string;
  fonte: string;
}

export const FORMULAS: readonly FormulaMetrica[] = [
  {
    id: "cadastros",
    nome: "Cadastros",
    formula: "Empresas criadas no período.",
    fonte: "Empresa.criadoEm",
  },
  {
    id: "confirmacao",
    nome: "Taxa de confirmação de e-mail",
    formula: "Cadastros do período cujo dono confirmou o e-mail ÷ cadastros do período.",
    fonte: "Usuario.emailConfirmadoEm",
  },
  {
    id: "ativacao",
    nome: "Taxa de ativação",
    formula:
      "Cadastros do período que já têm ao menos um projeto, conta, produto, compromisso ou perfil publicado ÷ cadastros do período. Conta o que existe nos dados hoje, não um clique.",
    fonte: "Obra, ContaFinanceira, Produto, Compromisso, PerfilPublico",
  },
  {
    id: "retencao",
    nome: "Retenção semanal",
    formula:
      "Para cada semana N depois do cadastro (semana 1 = os 7 primeiros dias): entre as empresas do período cujo cadastro já completou N semanas, as que registraram alguma ação no Elo Gestão naquela semana ÷ essas empresas. Conta como ação criar projeto, conta, produto, compromisso ou movimento de estoque, e qualquer criação, edição, baixa ou cancelamento no histórico das contas. Só abrir o sistema não conta, e o uso apenas do Elo Profissionais ainda não entra.",
    fonte: "Obra, ContaFinanceira (criadoEm e historico), Produto, Compromisso, MovimentoEstoque",
  },
  {
    id: "tour",
    nome: "Tour inicial",
    formula: "Donos dos cadastros do período por situação do tour (concluído, pulado, em andamento, não iniciado). Concluídos ÷ donos.",
    fonte: "ProgressoOnboarding",
  },
  {
    id: "conversao",
    nome: "Conversão do teste",
    formula:
      "Entre as empresas que iniciaram o teste no período e cujo prazo já terminou (ou que já mudaram de plano): as que estão no plano “ativo” ÷ essas empresas. Testes ainda em andamento ficam de fora. Hoje o plano é trocado à mão pela administração, então isto mede a conversão registrada, não pagamentos.",
    fonte: "EventoProduto (teste_iniciado) + Empresa.plano",
  },
  {
    id: "extensao",
    nome: "Efeito da extensão",
    formula: "Mesma conversão, separada entre empresas que receberam extensão e as que não receberam, para comparar.",
    fonte: "ExtensaoTeste",
  },
  {
    id: "emails",
    nome: "E-mails de ciclo de vida",
    formula: "E-mails da fila criados no período por campanha e situação. Descadastros: pessoas que saíram dos e-mails promocionais pelo link.",
    fonte: "EmailAgendado, EventoProduto (email_descadastro)",
  },
  {
    id: "ofertas",
    nome: "Ofertas e página de planos",
    formula:
      "Visualizações e cliques por lugar onde a oferta aparece, contando no máximo uma vez por pessoa, plano e dia. Taxa de clique = cliques ÷ visualizações. Clique é ir para a página de planos ou pedir contato; não é compra.",
    fonte: "EventoProduto (oferta_visualizada, oferta_clicada)",
  },
  {
    id: "indicacao",
    nome: "Cadastros por indicação",
    formula: "Cadastros do período que vieram de um link de convite ÷ cadastros do período.",
    fonte: "Empresa.convidadaPorId",
  },
];

/** O que o painel ainda não mede, dito às claras. */
export const NAO_MEDIDO: readonly { nome: string; motivo: string }[] = [
  { nome: "Abertura e clique nos e-mails", motivo: "O envio não recebe o retorno do provedor; só sabemos o que foi enviado ou falhou." },
  { nome: "Receita, assinaturas e cancelamentos", motivo: "Não há cobrança automática: o plano é trocado manualmente." },
];
