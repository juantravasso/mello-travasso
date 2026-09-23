// Cálculo puro do status do plano — sem I/O, para ser testável e reusável
// tanto no servidor (DAL, actions) quanto exposto ao client via ação.

export type Plano = "teste" | "cortesia" | "ativo" | "suspenso";

export interface StatusPlano {
  plano: Plano;
  /** null quando não há data de fim (cortesia/ativo). Pode ser negativo se o teste já venceu. */
  diasRestantes: number | null;
  somenteLeitura: boolean;
  /**
   * "dd/mm" já formatado a partir de testeTerminaEm — calculado aqui (server,
   * dado fixo) em vez de no componente da faixa, que não pode chamar
   * Date.now()/new Date() durante o render (regra de pureza do React).
   */
  dataFimFormatada: string | null;
}

const DIA_MS = 24 * 60 * 60 * 1000;

export function calcularStatusPlano(empresa: { plano: Plano; testeTerminaEm: string | null }): StatusPlano {
  if (empresa.plano !== "teste" || !empresa.testeTerminaEm) {
    return { plano: empresa.plano, diasRestantes: null, somenteLeitura: false, dataFimFormatada: null };
  }
  const dataFim = new Date(empresa.testeTerminaEm);
  const restanteMs = dataFim.getTime() - Date.now();
  const diasRestantes = Math.ceil(restanteMs / DIA_MS);
  const dataFimFormatada = dataFim.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
  return { plano: empresa.plano, diasRestantes, somenteLeitura: restanteMs <= 0, dataFimFormatada };
}
