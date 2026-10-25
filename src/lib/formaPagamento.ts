// Regras puras de como uma forma de pagamento se comporta nas contas. Cada empresa pode mudar isso em Configurações;
// sem configuração valem estes padrões: o que se paga na hora (dinheiro, PIX, débito, transferência) baixa sozinho; o
// que será pago depois (cartão de crédito, boleto, cheque) fica em aberto até o vencimento.

export interface ConfiguracaoForma {
  baixaAutomatica: boolean;
  /** Dia do mês (1 a 31) do vencimento, ex.: fatura do cartão. Nulo = vence na data do lançamento. */
  diaVencimento: number | null;
}

const BAIXA_AUTOMATICA_PADRAO: ReadonlySet<string> = new Set(["dinheiro", "pix", "cartao_debito", "transferencia"]);

/** Padrão de uma forma que a empresa ainda não configurou (as personalizadas começam sem baixa automática). */
export function configuracaoPadrao(chave: string): ConfiguracaoForma {
  return { baixaAutomatica: BAIXA_AUTOMATICA_PADRAO.has(chave), diaVencimento: null };
}

function diasNoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
}

/**
 * Próxima data, a partir de `dataIso` (inclusive), em que cai o dia de vencimento. Mês curto usa o último dia
 * (dia 31 em fevereiro vence dia 28 ou 29).
 */
export function proximoVencimento(dataIso: string, diaVencimento: number): string {
  const [ano, mes, dia] = dataIso.split("-").map(Number) as [number, number, number];
  const noMes = (a: number, m: number) => Math.min(diaVencimento, diasNoMes(a, m));
  let a = ano;
  let m = mes - 1;
  if (noMes(a, m) < dia) {
    m += 1;
    if (m > 11) {
      m = 0;
      a += 1;
    }
  }
  return `${a}-${String(m + 1).padStart(2, "0")}-${String(noMes(a, m)).padStart(2, "0")}`;
}

/** Cadastro completo = categoria e forma de pagamento escolhidas (mesma regra da tela de completar cadastro). */
export function cadastroCompleto(c: { categoria?: string | null; formaPagamento?: string | null }): boolean {
  return Boolean(c.categoria?.trim()) && Boolean(c.formaPagamento?.trim());
}

/** Conta nova ou editada que já pode nascer baixada: cadastro completo, forma com baixa automática, sem parcelas. */
export function deveBaixarSozinha(c: { categoria?: string | null; formaPagamento?: string | null; parcelada: boolean }, config: ConfiguracaoForma): boolean {
  return config.baixaAutomatica && !c.parcelada && cadastroCompleto(c);
}

/** Data em que a baixa automática é registrada: a do vencimento, mas nunca no futuro. */
export function dataDaBaixaAutomatica(dataVencimento: string, hojeIso: string): string {
  return dataVencimento <= hojeIso ? dataVencimento : hojeIso;
}

/** Uma forma de pagamento (padrão ou criada pela empresa) com a configuração que vale hoje. */
export interface FormaPagamentoConfigurada extends ConfiguracaoForma {
  chave: string;
  rotulo: string;
  /** Padrão do sistema (não pode ser apagada) ou criada pela empresa. */
  padrao: boolean;
}
