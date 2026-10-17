import { createHash, timingSafeEqual } from "node:crypto";
import { processarLembretes } from "@/services/data/server/lembretesWorker.server";

// Processa os lembretes do calendário que já venceram. Quem chama é um agendador externo (GitHub Actions a cada
// 5 minutos, ver .github/workflows/lembretes.yml; também serve o Vercel Cron do plano Pro). Não depende de
// ninguém estar com o site aberto, e é seguro chamar várias vezes ou em paralelo: o processamento é idempotente.
//
// Autorização: "Authorization: Bearer <CRON_SECRET>". Sem CRON_SECRET configurado a rota fica fechada (503), nunca
// aberta. A resposta traz só contadores.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function segredoConfere(cabecalho: string | null, segredo: string): boolean {
  if (!cabecalho?.startsWith("Bearer ")) return false;
  // Compara os hashes (tamanho fixo) em tempo constante.
  const a = createHash("sha256").update(cabecalho.slice("Bearer ".length)).digest();
  const b = createHash("sha256").update(segredo).digest();
  return timingSafeEqual(a, b);
}

async function tratar(request: Request): Promise<Response> {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) {
    console.error("[cron/lembretes] CRON_SECRET ausente: rota fechada.");
    return Response.json({ ok: false, erro: "Agendador não configurado." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  if (!segredoConfere(request.headers.get("authorization"), segredo)) {
    return Response.json({ ok: false, erro: "Não autorizado." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  try {
    const resultado = await processarLembretes();
    return Response.json({ ok: true, ...resultado }, { headers: { "Cache-Control": "no-store" } });
  } catch (erro) {
    console.error("[cron/lembretes] falha:", erro instanceof Error ? erro.name : "erro");
    return Response.json({ ok: false, erro: "Falha ao processar." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}

export const GET = tratar;
export const POST = tratar;
