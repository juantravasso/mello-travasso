import { headers } from "next/headers";
import { extrairIpConfiavel, verificarLimite } from "@/lib/auth/limite";
import { descadastrarPorToken } from "@/services/data/server/cicloDeVidaCore.server";

// Descadastro de um clique (RFC 8058): os provedores de e-mail enviam um POST a este endereço quando a pessoa usa o
// botão "cancelar inscrição" do próprio cliente de e-mail (cabeçalho List-Unsubscribe). O GET não muda nada: leva para
// a página de confirmação, porque leitores de e-mail e antivírus "visitam" links e não podem descadastrar ninguém.

export const dynamic = "force-dynamic";

export async function POST(_request: Request, contexto: { params: Promise<{ token: string }> }): Promise<Response> {
  const ip = await verificarLimite(`descadastro-ip:${extrairIpConfiavel(await headers())}`, 60, 60 * 60 * 1000);
  if (!ip.permitido) return new Response(null, { status: 429 });
  const { token } = await contexto.params;
  // Resposta 200 igual para token existente e inexistente.
  await descadastrarPorToken(token);
  return new Response(null, { status: 200, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request, contexto: { params: Promise<{ token: string }> }): Promise<Response> {
  const { token } = await contexto.params;
  return Response.redirect(new URL(`/descadastrar/${encodeURIComponent(token)}`, request.url), 302);
}
