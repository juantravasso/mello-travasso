import { lerDocumentoParaAdmin } from "@/services/data/server/documentoAcesso.server";

// Documento de verificação: só administrador, sempre como download (nunca aberto
// no navegador dentro do app), sem cache e sem nenhuma interpretação do conteúdo.
const EXTENSAO: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const CABECALHOS_ERRO = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

export async function GET(_request: Request, contexto: { params: Promise<{ id: string }> }) {
  const { id } = await contexto.params;
  const resultado = await lerDocumentoParaAdmin(id);
  if (!resultado.ok) return new Response(null, { status: resultado.status, headers: CABECALHOS_ERRO });

  return new Response(new Uint8Array(resultado.bytes), {
    status: 200,
    headers: {
      "Content-Type": resultado.mime,
      "Content-Length": String(resultado.bytes.byteLength),
      "Content-Disposition": `attachment; filename="documento-${id.slice(0, 8)}.${EXTENSAO[resultado.mime] ?? "bin"}"`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "X-Robots-Tag": "noindex, noimageindex",
      "Cache-Control": "private, no-store",
    },
  });
}
