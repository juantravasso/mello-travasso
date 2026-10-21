import { createHash, timingSafeEqual } from "node:crypto";
import { processarAssinaturasComerciais } from "@/services/data/server/assinaturaComercialCore.server";

// Expira reservas de vaga vencidas, avisa por e-mail quem está perto da renovação anual e suspende quem passou do
// vencimento sem renovar (ver assinaturaComercialCore.server.ts). Quem chama é um agendador externo (GitHub
// Actions, ver .github/workflows/assinaturas.yml). Idempotente e seguro em paralelo.
//
// Autorização: "Authorization: Bearer <CRON_SECRET>" (mesmo segredo do /api/cron/lembretes). Sem CRON_SECRET
// configurado a rota fica fechada (503), nunca aberta.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function segredoConfere(cabecalho: string | null, segredo: string): boolean {
  if (!cabecalho?.startsWith("Bearer ")) return false;
  const a = createHash("sha256").update(cabecalho.slice("Bearer ".length)).digest();
  const b = createHash("sha256").update(segredo).digest();
  return timingSafeEqual(a, b);
}

async function tratar(request: Request): Promise<Response> {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) {
    console.error("[cron/assinaturas] CRON_SECRET ausente: rota fechada.");
    return Response.json({ ok: false, erro: "Agendador não configurado." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  if (!segredoConfere(request.headers.get("authorization"), segredo)) {
    return Response.json({ ok: false, erro: "Não autorizado." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  try {
    const resultado = await processarAssinaturasComerciais();
    return Response.json({ ok: true, ...resultado }, { headers: { "Cache-Control": "no-store" } });
  } catch (erro) {
    console.error("[cron/assinaturas] falha:", erro instanceof Error ? erro.name : "erro");
    return Response.json({ ok: false, erro: "Falha ao processar." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}

export const GET = tratar;
export const POST = tratar;
