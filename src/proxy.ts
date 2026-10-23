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
  if (temCookie) {
    // Os layouts não recebem o caminho da página; este cabeçalho (sempre sobrescrito aqui, nunca o que o
    // cliente mandar) deixa o layout de (app) conferir o módulo da rota. A barreira real continua nas ações.
    const cabecalhos = new Headers(request.headers);
    cabecalhos.set("x-pathname", request.nextUrl.pathname);
    return NextResponse.next({ request: { headers: cabecalhos } });
  }

  const destino = new URL("/login", request.url);
  destino.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(destino);
}

export const config = {
  // Roda em tudo, exceto: assets do Next, favicon, as rotas públicas
  // (landing "/", "/login", "/criar-conta", "/confirmar-email", "/esqueci-senha", "/redefinir-senha", "/termos", "/privacidade", "/descadastrar/<token>", a rede
  // profissional pública "/rede" e "/empresas/<slug>", sitemap, robots e os arquivos públicos da
  // marca: ícones, manifest e imagem de compartilhamento) e
  // /api/**. Redirecionar uma chamada de API (fetch/XHR) para a página HTML
  // de login quebra o cliente, que espera JSON — cada rota de API chama
  // exigirSessaoAction() e responde 401 em JSON quando não há sessão (ver
  // src/app/(app)/api/ai/extract-recibo). A área logada da rede fica em
  // "/minha-rede" (não "/rede"), então continua protegida por este proxy.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|login|criar-conta|confirmar-email|esqueci-senha|redefinir-senha|termos|privacidade|descadastrar/|rede(?:/|$)|empresas/|sitemap.xml|robots.txt|icon$|apple-icon$|icones/|opengraph-image$|manifest.webmanifest$|api|$).*)",
  ],
};
