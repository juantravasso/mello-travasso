// Período pago de uma assinatura mensal. Quem cancela mantém o acesso até o fim do período que já pagou (a próxima
// cobrança deixa de acontecer, mas o mês pago continua valendo). Funções puras, sem relógio global.

/** Soma meses mantendo o dia do mês; em mês mais curto cai no último dia (31/01 + 1 mês = 28/02 ou 29/02). */
export function somarMeses(base: Date, meses: number): Date {
  const ano = base.getUTCFullYear();
  const mes = base.getUTCMonth() + meses;
  const ultimoDiaDoMes = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
  return new Date(Date.UTC(ano, mes, Math.min(base.getUTCDate(), ultimoDiaDoMes), base.getUTCHours(), base.getUTCMinutes(), base.getUTCSeconds(), base.getUTCMilliseconds()));
}

/**
 * Até quando vale o período já pago, dada a data de uma cobrança (`proximaCobrancaIso`, a próxima cobrança conhecida)
 * e o momento atual. Se essa data ainda não chegou, o período pago termina nela. Se já passou (a assinatura foi
 * renovando mês a mês e o valor guardado ficou para trás), avança de mês em mês, sempre a partir da data original,
 * até a primeira cobrança que ainda vai acontecer.
 */
export function fimDoPeriodoPago(proximaCobrancaIso: string, agora: Date): Date {
  const base = new Date(proximaCobrancaIso);
  if (Number.isNaN(base.getTime())) throw new Error("Data de cobrança inválida.");
  let candidata = base;
  for (let k = 1; candidata.getTime() <= agora.getTime(); k++) {
    if (k > 1200) throw new Error("Data de cobrança longe demais do presente.");
    candidata = somarMeses(base, k);
  }
  return candidata;
}
