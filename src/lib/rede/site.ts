let avisouSemUrl = false;

/** URL pública do site, sem barra final. Configure NEXT_PUBLIC_SITE_URL em produção. */
export function urlDoSite(): string {
  const configurada = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!configurada && process.env.NODE_ENV === "production" && !avisouSemUrl) {
    avisouSemUrl = true;
    console.error("[rede] NEXT_PUBLIC_SITE_URL não definido: canonical, sitemap e JSON-LD vão apontar para localhost.");
  }
  return (configurada && configurada.length > 0 ? configurada : "http://localhost:3000").replace(/\/+$/, "");
}

const BARRA = String.fromCharCode(92);
const CARACTERES_PERIGOSOS = new RegExp(`[<${String.fromCharCode(0x2028)}${String.fromCharCode(0x2029)}]`, "g");

/**
 * Serializa JSON-LD sem permitir que o conteúdo feche a tag script: "<" e os
 * separadores de linha U+2028/2029 viram escapes unicode de 4 dígitos, que o
 * JSON.parse do navegador interpreta de volta como o mesmo caractere.
 */
export function jsonLdSeguro(dados: unknown): string {
  return JSON.stringify(dados).replace(
    CARACTERES_PERIGOSOS,
    (c) => `${BARRA}u${c.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );
}
