import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Checagem OTIMISTA: só olha se o cookie de sessão existe, sem consultar o
// banco (ver node_modules/next/dist/docs/01-app/02-guides/authentication.md).
// Não é a barreira de segurança — quem valida de verdade é exigirSessao()/
// exigirSessaoAction() no DAL, chamado em (app)/layout.tsx e em cada Server
// Action. Um cookie forjado passa por aqui mas cai em "sessão não encontrada"
// no DAL.

const NOME_COOKIE = "mt_sessao";

export function proxy(request: NextRequest) {
  const temCookie = request.cookies.has(NOME_COOKIE);
  if (temCookie) return NextResponse.next();

  const destino = new URL("/login", request.url);
  destino.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(destino);
}

export const config = {
  // Roda em tudo, exceto: assets do Next, favicon, as rotas públicas
  // (landing "/", "/login", "/criar-conta", "/termos", "/privacidade") e
  // /api/**. Redirecionar uma chamada de API (fetch/XHR) para a página HTML
  // de login quebra o cliente, que espera JSON — cada rota de API chama
  // exigirSessaoAction() e responde 401 em JSON quando não há sessão (ver
  // src/app/(app)/api/ai/extract-recibo).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|login|criar-conta|termos|privacidade|api|$).*)"],
};
