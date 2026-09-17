import type { ContaFinanceira, Obra, ResumoFinanceiroObra } from "@/types";

export function calcularResumoFinanceiro(obra: Obra, contas: ContaFinanceira[]): ResumoFinanceiroObra {
  const contasPagar = contas.filter((c) => c.tipo === "pagar");
  const contasReceber = contas.filter((c) => c.tipo === "receber");

  const totalPago = contasPagar.filter((c) => c.status === "baixada").reduce((s, c) => s + c.valor, 0);
  const totalEmAberto = contasPagar.filter((c) => c.status === "em_aberto").reduce((s, c) => s + c.valor, 0);
  const totalRecebido = contasReceber.filter((c) => c.status === "baixada").reduce((s, c) => s + c.valor, 0);
  const totalAReceber = contasReceber.filter((c) => c.status === "em_aberto").reduce((s, c) => s + c.valor, 0);

  return {
    obraId: obra.id,
    totalPago,
    totalEmAberto,
    totalRecebido,
    totalAReceber,
    orcamentoPrevisto: obra.orcamentoPrevisto,
    saldoOrcamento: obra.orcamentoPrevisto !== undefined ? obra.orcamentoPrevisto - totalPago : undefined,
  };
}
