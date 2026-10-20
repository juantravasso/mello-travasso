// Cálculo puro do status do plano — sem I/O, para ser testável e reusável
// tanto no servidor (DAL, actions) quanto exposto ao client via ação.
import { fimDoTesteEmDias } from "@/lib/cicloDeVida/datas";

export type Plano = "teste" | "cortesia" | "ativo" | "suspenso" | "gratuito";

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

/**
 * Fim de um teste que começa agora: hoje + `dias`, 23:59 em America/Sao_Paulo (RF-07). A duração padrão é 14 dias e
 * vem da configuração da plataforma (ConfiguracaoPlataforma, editável pelo administrador); quem já está em teste
 * mantém a data que tem. A regra de datas fica em lib/cicloDeVida/datas.ts.
 */
export function calcularFimDoTeste(dias: number = 14, agora: Date = new Date()): string {
  return fimDoTesteEmDias(agora, dias).toISOString();
}

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
