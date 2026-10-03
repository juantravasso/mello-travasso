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

export interface MotivoDenuncia {
  chave:
    | "fraude"
    | "avaliacao_falsa"
    | "nunca_trabalhou"
    | "conteudo_ofensivo"
    | "spam"
    | "informacao_falsa"
    | "conflito_interesse"
    | "outro";
  rotulo: string;
}

export const MOTIVOS_DENUNCIA: readonly MotivoDenuncia[] = [
  { chave: "conteudo_ofensivo", rotulo: "Conteúdo ofensivo ou inadequado" },
  { chave: "nunca_trabalhou", rotulo: "Nunca trabalhou com esta empresa" },
  { chave: "avaliacao_falsa", rotulo: "Avaliação falsa" },
  { chave: "fraude", rotulo: "Possível fraude" },
  { chave: "informacao_falsa", rotulo: "Informação falsa" },
  { chave: "conflito_interesse", rotulo: "Conflito de interesse" },
  { chave: "spam", rotulo: "Spam" },
  { chave: "outro", rotulo: "Outro (inclui pedido de remoção)" },
];

/** Motivos que só fazem sentido para avaliação (não para um perfil). */
const SO_AVALIACAO = new Set<string>(["nunca_trabalhou", "avaliacao_falsa"]);

export function motivosParaAlvo(alvo: "avaliacao" | "perfil"): readonly MotivoDenuncia[] {
  return alvo === "avaliacao" ? MOTIVOS_DENUNCIA : MOTIVOS_DENUNCIA.filter((m) => !SO_AVALIACAO.has(m.chave));
}

export function rotuloMotivoDenuncia(chave: string): string {
  return MOTIVOS_DENUNCIA.find((m) => m.chave === chave)?.rotulo ?? chave;
}

export const ROTULOS_STATUS_DENUNCIA: Record<string, string> = {
  aberta: "Aberta",
  em_analise: "Em análise",
  aguardando_informacoes: "Aguardando informações",
  resolvida: "Resolvida",
  rejeitada: "Rejeitada",
};
