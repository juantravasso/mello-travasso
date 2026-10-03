export interface Aspecto {
  chave: string;
  rotulo: string;
}

// Lista fechada de propósito: pontos positivos/negativos escolhidos de uma
// lista (e não digitados) evitam acusações em campo livre. O texto livre fica
// só no comentário, que passa por moderação (Fase 6.3).
export const ASPECTOS_POSITIVOS: readonly Aspecto[] = [
  { chave: "pontualidade", rotulo: "Pontualidade" },
  { chave: "qualidade", rotulo: "Qualidade do serviço" },
  { chave: "comunicacao", rotulo: "Boa comunicação" },
  { chave: "preco_justo", rotulo: "Preço justo" },
  { chave: "organizacao", rotulo: "Organização e limpeza" },
  { chave: "cumpriu_orcamento", rotulo: "Cumpriu o orçamento" },
];

export const ASPECTOS_NEGATIVOS: readonly Aspecto[] = [
  { chave: "atraso", rotulo: "Atraso no prazo" },
  { chave: "qualidade_baixa", rotulo: "Qualidade abaixo do esperado" },
  { chave: "comunicacao_ruim", rotulo: "Comunicação ruim" },
  { chave: "preco_acima", rotulo: "Preço acima do combinado" },
  { chave: "desorganizacao", rotulo: "Desorganização" },
  { chave: "demora_orcamento", rotulo: "Demora para enviar o orçamento" },
];

export const CHAVES_POSITIVAS = ASPECTOS_POSITIVOS.map((a) => a.chave) as [string, ...string[]];
export const CHAVES_NEGATIVAS = ASPECTOS_NEGATIVOS.map((a) => a.chave) as [string, ...string[]];

const ROTULOS = new Map([...ASPECTOS_POSITIVOS, ...ASPECTOS_NEGATIVOS].map((a) => [a.chave, a.rotulo]));

export function rotuloAspecto(chave: string): string {
  return ROTULOS.get(chave) ?? chave;
}
