// Cursor da paginação do feed. Só o servidor usa (Buffer); fica fora de feed.ts, que a tela também importa.

export interface Cursor {
  criadoEm: string;
  id: string;
}

/** Cursor opaco da paginação: data + id da última postagem entregue. */
export function codificarCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify(c), "utf8").toString("base64url");
}

export function decodificarCursor(valor: string): Cursor | null {
  try {
    const bruto = JSON.parse(Buffer.from(valor, "base64url").toString("utf8")) as Partial<Cursor>;
    if (typeof bruto.criadoEm !== "string" || typeof bruto.id !== "string") return null;
    if (Number.isNaN(Date.parse(bruto.criadoEm)) || bruto.id.length > 64) return null;
    return { criadoEm: bruto.criadoEm, id: bruto.id };
  } catch {
    return null;
  }
}
