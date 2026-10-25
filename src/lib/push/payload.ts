// Conteúdo da notificação push. O aparelho mostra título e texto sem rolagem, então os dois são curtos; o link é sempre
// um caminho interno (o service worker abre isso dentro do app, nunca um endereço de fora).

export interface PayloadPush {
  titulo: string;
  texto: string;
  href: string;
}

const LIMITE_TITULO = 80;
const LIMITE_TEXTO = 180;
const HREF_PADRAO = "/calendario";

function cortar(valor: string, limite: number): string {
  const limpo = valor.replace(/\s+/g, " ").trim();
  return limpo.length <= limite ? limpo : `${limpo.slice(0, limite - 1).trimEnd()}…`;
}

/** Só caminho interno ("/calendario?x=1"); "//outro.site" e "https://..." viram o padrão. */
export function hrefInterno(href: string): string {
  return /^\/(?!\/)[^\s\\]*$/.test(href) ? href : HREF_PADRAO;
}

export function montarPayloadPush(entrada: { titulo?: string | null; texto: string; href: string }): PayloadPush {
  return { titulo: cortar(entrada.titulo ?? "", LIMITE_TITULO) || "Lembrete", texto: cortar(entrada.texto, LIMITE_TEXTO), href: hrefInterno(entrada.href) };
}
