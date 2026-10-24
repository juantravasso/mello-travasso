// Abas favoritas: são as que aparecem na barra de baixo do celular. Regras puras (sem React e sem armazenamento), para
// serem testadas. A escolha é por aparelho (fica no navegador), porque a barra de baixo é do celular da pessoa.

/** Cabem 5 abas na barra de baixo sem rolar. */
export const MAXIMO_FAVORITOS = 5;

/** Quem nunca escolheu começa com estas, na ordem, as que a pessoa pode acessar. */
export const FAVORITOS_PADRAO: readonly string[] = ["/rede", "/dashboard", "/calendario", "/capturar", "/contas-a-pagar"];

/**
 * Lista final de favoritos: o que foi salvo (só o que ainda é permitido, sem repetir e até o máximo), ou o padrão se
 * nada foi salvo, o valor está quebrado ou nada sobrou. Nunca devolve lista vazia se houver aba permitida.
 */
export function resolverFavoritos(salvoBruto: string | null, permitidos: readonly string[]): string[] {
  const liberadas = new Set(permitidos);
  const padrao = FAVORITOS_PADRAO.filter((href) => liberadas.has(href)).slice(0, MAXIMO_FAVORITOS);
  const alternativa = padrao.length > 0 ? padrao : permitidos.slice(0, MAXIMO_FAVORITOS);
  if (salvoBruto === null) return [...alternativa];

  let lista: unknown;
  try {
    lista = JSON.parse(salvoBruto);
  } catch {
    return [...alternativa];
  }
  if (!Array.isArray(lista)) return [...alternativa];

  const vistos = new Set<string>();
  const limpa: string[] = [];
  for (const valor of lista) {
    if (typeof valor !== "string" || !liberadas.has(valor) || vistos.has(valor)) continue;
    vistos.add(valor);
    limpa.push(valor);
    if (limpa.length === MAXIMO_FAVORITOS) break;
  }
  return limpa.length > 0 ? limpa : [...alternativa];
}

export interface ResultadoAlternancia {
  lista: string[];
  /** Quando a aba não entrou porque a barra já está cheia. */
  limiteAtingido: boolean;
}

/** Liga ou desliga uma aba dos favoritos. Desligar a última não deixa a barra vazia: a lista nunca fica com 0 itens. */
export function alternarFavorito(atuais: readonly string[], href: string): ResultadoAlternancia {
  if (atuais.includes(href)) {
    if (atuais.length === 1) return { lista: [...atuais], limiteAtingido: false };
    return { lista: atuais.filter((h) => h !== href), limiteAtingido: false };
  }
  if (atuais.length >= MAXIMO_FAVORITOS) return { lista: [...atuais], limiteAtingido: true };
  return { lista: [...atuais, href], limiteAtingido: false };
}
