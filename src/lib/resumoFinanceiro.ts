import type { ContaFinanceira, Obra, ResumoFinanceiroObra } from "@/types";
import { valorDoDestino } from "./estoque/rateio";

/**
 * Resumo do projeto. `totalMateriaisDoDeposito` é o material transferido do Depósito (ao valor da última compra): é
 * gasto do projeto mesmo sem conta, e soma ao que já foi pago para medir o orçamento. Numa nota rateada entre
 * destinos, só a parte do projeto conta (`valorDoDestino`).
 */
export function calcularResumoFinanceiro(obra: Obra, contas: ContaFinanceira[], totalMateriaisDoDeposito = 0): ResumoFinanceiroObra {
  const parte = (c: ContaFinanceira) => valorDoDestino(c, obra.id);
  const contasPagar = contas.filter((c) => c.tipo === "pagar");
  const contasReceber = contas.filter((c) => c.tipo === "receber");

  const totalPago = contasPagar.filter((c) => c.status === "baixada").reduce((s, c) => s + parte(c), 0);
  const totalEmAberto = contasPagar.filter((c) => c.status === "em_aberto").reduce((s, c) => s + parte(c), 0);
  const totalRecebido = contasReceber.filter((c) => c.status === "baixada").reduce((s, c) => s + parte(c), 0);
  const totalAReceber = contasReceber.filter((c) => c.status === "em_aberto").reduce((s, c) => s + parte(c), 0);

  return {
    obraId: obra.id,
    totalPago,
    totalEmAberto,
    totalRecebido,
    totalAReceber,
    totalMateriaisDoDeposito,
    orcamentoPrevisto: obra.orcamentoPrevisto,
    saldoOrcamento: obra.orcamentoPrevisto !== undefined ? obra.orcamentoPrevisto - totalPago - totalMateriaisDoDeposito : undefined,
  };
}
