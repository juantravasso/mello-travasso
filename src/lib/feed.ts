/** Regras do feed que valem no servidor e na tela (limites e normalização de texto). */

export const MAX_TEXTO_POSTAGEM = 1500;
export const MAX_TEXTO_COMENTARIO = 500;
export const MAX_FOTOS_POSTAGEM = 4;
export const POSTAGENS_POR_DIA = 10;
export const COMENTARIOS_POR_DIA = 60;
export const CURTIDAS_POR_DIA = 300;
export const TAMANHO_PAGINA_FEED = 10;
/** Comentários mostrados por postagem (o mais recente por último). */
export const COMENTARIOS_POR_PAGINA = 20;

/** Padroniza quebras de linha, tira espaços das pontas e limita linhas em branco seguidas a uma. */
export function normalizarTextoLivre(texto: string): string {
  return texto
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** "agora", "há 5 min", "há 3 h", "há 2 d" ou a data, para o carimbo de tempo dos cartões. */
export function tempoRelativo(iso: string, agora: Date = new Date()): string {
  const diff = agora.getTime() - new Date(iso).getTime();
  if (!Number.isFinite(diff) || diff < 60_000) return "agora";
  const min = Math.floor(diff / 60_000);
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `há ${d} d`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo" });
}
