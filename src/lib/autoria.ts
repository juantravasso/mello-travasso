import type { ContaFinanceira } from "@/types";

/** Quem lançou a conta: o autor do evento de criação no histórico (o nome do usuário no momento do lançamento). */
export function lancadoPor(conta: Pick<ContaFinanceira, "historico">): string | undefined {
  return conta.historico.find((evento) => evento.tipo === "criacao")?.usuario;
}
