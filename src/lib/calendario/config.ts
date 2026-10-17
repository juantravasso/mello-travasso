// Regras configuráveis do calendário e dos lembretes.

export const FUSO_PADRAO = "America/Sao_Paulo";

/** Fusos que a empresa pode escolher (Brasil). O compromisso guarda o fuso da empresa no momento em que foi salvo. */
export const FUSOS_DA_EMPRESA = [
  { valor: "America/Sao_Paulo", rotulo: "Brasília (São Paulo, Rio, Minas, Sul)" },
  { valor: "America/Bahia", rotulo: "Bahia" },
  { valor: "America/Fortaleza", rotulo: "Fortaleza (CE, RN, PI, MA, PB)" },
  { valor: "America/Recife", rotulo: "Recife (PE, AL, SE)" },
  { valor: "America/Belem", rotulo: "Belém (PA, AP)" },
  { valor: "America/Cuiaba", rotulo: "Cuiabá (MT)" },
  { valor: "America/Campo_Grande", rotulo: "Campo Grande (MS)" },
  { valor: "America/Manaus", rotulo: "Manaus (AM, RR, RO)" },
  { valor: "America/Rio_Branco", rotulo: "Rio Branco (AC)" },
  { valor: "America/Noronha", rotulo: "Fernando de Noronha" },
] as const;

const FUSOS_VALIDOS: ReadonlySet<string> = new Set(FUSOS_DA_EMPRESA.map((f) => f.valor));

export function fusoPermitido(fuso: string): boolean {
  return FUSOS_VALIDOS.has(fuso);
}

function horaDaVariavel(nome: string, padrao: number): number {
  const bruto = process.env[nome];
  const valor = bruto === undefined || bruto.trim() === "" ? NaN : Number(bruto);
  return Number.isInteger(valor) && valor >= 0 && valor <= 23 ? valor : padrao;
}

export interface ConfigLembretes {
  /** Hora local do lembrete de um compromisso de dia inteiro (vale para o dia anterior e para o próprio dia). */
  horaDiaInteiro: number;
  /** Hora local do lembrete "do dia" de um compromisso com horário. */
  horaDoDia: number;
  /** O lembrete "do dia" nunca fica a menos de tantos minutos do início (nem depois dele). */
  antecedenciaDoDiaMin: number;
}

/** Lida a cada uso para refletir as variáveis de ambiente; os padrões valem sem configuração. */
export function configLembretes(): ConfigLembretes {
  return {
    horaDiaInteiro: horaDaVariavel("CALENDARIO_HORA_DIA_INTEIRO", 9),
    horaDoDia: horaDaVariavel("CALENDARIO_HORA_LEMBRETE_DO_DIA", 8),
    antecedenciaDoDiaMin: 60,
  };
}

/** Tentativas de envio de um lembrete (espera em minutos antes da tentativa seguinte). */
export const ESPERA_ENTRE_TENTATIVAS_MIN = [5, 15, 60, 180] as const;
export const MAX_TENTATIVAS = ESPERA_ENTRE_TENTATIVAS_MIN.length + 1;
