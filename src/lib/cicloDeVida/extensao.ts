import type { ConfigCicloDeVida } from "./config";

// Regras de quem pode receber uma extensão do teste e de quanto. Pura: o servidor passa o histórico lido do banco,
// dentro da transação, e grava só se esta função disser que sim.

export type ResultadoExtensao = { ok: true } | { ok: false; mensagem: string };

export function avaliarExtensao(entrada: {
  config: ConfigCicloDeVida["extensao"];
  plano: string;
  /** Dias de cada extensão já concedida a esta empresa. */
  extensoesAnteriores: number[];
  dias: number;
}): ResultadoExtensao {
  const { config, plano, extensoesAnteriores, dias } = entrada;
  if (!config.ativa) return { ok: false, mensagem: "As extensões de teste estão desativadas nas configurações." };
  if (plano !== "teste") return { ok: false, mensagem: "Só dá para estender um teste: esta empresa não está no plano de teste." };
  if (!Number.isInteger(dias) || dias < 1) return { ok: false, mensagem: "Informe um número inteiro de dias, de 1 em diante." };
  if (dias > config.maxDiasPorExtensao) {
    return { ok: false, mensagem: `Cada extensão pode ter no máximo ${config.maxDiasPorExtensao} dia(s).` };
  }
  if (extensoesAnteriores.length >= config.maxExtensoes) {
    return { ok: false, mensagem: `Esta empresa já recebeu ${extensoesAnteriores.length} extensão(ões); o limite é ${config.maxExtensoes}.` };
  }
  const jaConcedidos = extensoesAnteriores.reduce((soma, d) => soma + d, 0);
  if (jaConcedidos + dias > config.maxDiasTotal) {
    const restam = Math.max(0, config.maxDiasTotal - jaConcedidos);
    return { ok: false, mensagem: `O limite total é de ${config.maxDiasTotal} dia(s) estendidos por empresa. Restam ${restam}.` };
  }
  return { ok: true };
}
