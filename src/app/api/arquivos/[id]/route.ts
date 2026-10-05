import { z } from "zod";
import { obterSessaoOpcional } from "@/lib/auth/dal";
import { lerBytesArquivo, lerMetaArquivo } from "@/services/data/server/armazenamento.server";

// Serve imagens do portfólio e logos. Pública só para arquivos de perfil
// PUBLICADO; o dono vê as suas imagens também em rascunho. Documentos
// (finalidade "documento") nunca saem por aqui. Resposta idêntica (404) para
// "não existe" e "não pode ver", para não confirmar ids.
//
// Custo: a decisão de acesso usa só metadados (sem os bytes). O conteúdo de um
// id nunca muda, então o ETag é o próprio id e uma revalidação vira 304 sem
// tocar nos bytes. O cache é curto e com revalidação obrigatória, para que
// despublicar, suspender ou apagar passe a valer em segundos.

const idSchema = z.string().uuid();

const CABECALHOS_404 = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

function naoEncontrado() {
  return new Response(null, { status: 404, headers: CABECALHOS_404 });
}

export async function GET(request: Request, contexto: { params: Promise<{ id: string }> }) {
  const { id } = await contexto.params;
  if (!idSchema.safeParse(id).success) return naoEncontrado();

  const meta = await lerMetaArquivo(id);
  if (!meta || meta.finalidade === "documento") return naoEncontrado();

  const publico = meta.perfil?.status === "publicado";
  let privado = false;
  if (!publico) {
    const sessao = await obterSessaoOpcional();
    if (!sessao || sessao.empresaId !== meta.empresaId) return naoEncontrado();
    privado = true;
  }

  const cabecalhos: Record<string, string> = {
    "Content-Type": meta.mime,
    "X-Content-Type-Options": "nosniff",
    // Mesmo que algo viesse a ser interpretado como documento, nada executa.
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "X-Robots-Tag": "noimageindex, noindex",
    "Cache-Control": privado ? "private, no-store" : "public, max-age=60, must-revalidate",
  };

  if (!privado) {
    const etag = `"${id}"`;
    cabecalhos.ETag = etag;
    if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers: cabecalhos });
  }

  const dados = await lerBytesArquivo(id);
  if (!dados) return naoEncontrado();
  cabecalhos["Content-Length"] = String(dados.byteLength);
  return new Response(dados as unknown as BodyInit, { status: 200, headers: cabecalhos });
}
