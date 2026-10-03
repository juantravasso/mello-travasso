import { normalizarDescricao } from "@/lib/normalizarTexto";

/** "Eletricista & Cia" → "eletricista-cia". Sem acento, minúsculo, só [a-z0-9-]. */
export function gerarSlug(texto: string, maximo = 60): string {
  const slug = normalizarDescricao(texto)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maximo)
    .replace(/-+$/g, "");
  return slug || "perfil";
}

/** Texto de busca: minúsculo, sem acento, espaços colapsados. */
export function normalizarBusca(texto: string): string {
  return normalizarDescricao(texto).replace(/\s+/g, " ");
}

/** Só dígitos, sem o +55 — 10 (fixo) ou 11 (celular) dígitos; null se não couber. */
export function normalizarTelefone(valor: string): string | null {
  let digitos = valor.replace(/\D/g, "");
  if (digitos.length >= 12 && digitos.startsWith("55")) digitos = digitos.slice(2);
  return digitos.length === 10 || digitos.length === 11 ? digitos : null;
}

export function formatarTelefone(digitos: string): string {
  if (digitos.length === 11) return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
  if (digitos.length === 10) return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
  return digitos;
}

const REGEX_INSTAGRAM = /^(?:https?:\/\/(?:www\.)?instagram\.com\/)?@?([A-Za-z0-9._]{1,30})\/?$/;

/** Aceita "@usuario", "usuario" ou o link do perfil; devolve só o usuário, ou null. */
export function normalizarInstagram(valor: string): string | null {
  const m = REGEX_INSTAGRAM.exec(valor.trim());
  return m?.[1] ?? null;
}

/** Só http/https, sem credenciais embutidas; assume https quando falta o esquema. */
export function normalizarSite(valor: string): string | null {
  const texto = valor.trim();
  if (!texto || texto.length > 200) return null;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(texto) ? texto : `https://${texto}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    if (!url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** dd/mm/aaaa no fuso de Brasília (o servidor pode estar em UTC). */
export function formatarDataBr(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}
