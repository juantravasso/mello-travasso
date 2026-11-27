import { createHash, timingSafeEqual } from "node:crypto";
import { limparMemoriasVencidas } from "@/services/data/server/assistente/assistenteCore.server";
import { processarCicloDeVida } from "@/services/data/server/cicloDeVidaCore.server";
import { enviarAvisosWhatsapp, type ResultadoAvisosWhatsapp } from "@/services/data/server/whatsappAvisosCore.server";

// Processa o ciclo de vida do cliente: avisos de fim do teste, campanhas de e-mail e a fila de envio. Quem chama é um
// agendador externo (GitHub Actions, ver .github/workflows/ciclo-de-vida.yml). É seguro chamar várias vezes ou em
// paralelo: o processamento é idempotente (chaves únicas na fila e nos eventos).
//
// Autorização: "Authorization: Bearer <CRON_SECRET>", o mesmo segredo da rota de lembretes. Sem CRON_SECRET a rota fica
// fechada (503), nunca aberta. A resposta traz só contadores.

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
    console.error("[cron/ciclo-de-vida] CRON_SECRET ausente: rota fechada.");
    return Response.json({ ok: false, erro: "Agendador não configurado." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  if (!segredoConfere(request.headers.get("authorization"), segredo)) {
    return Response.json({ ok: false, erro: "Não autorizado." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  try {
    const resultado = await processarCicloDeVida();
    // Avisos pelo WhatsApp na mesma rodada; uma falha aqui não derruba o resultado dos e-mails.
    let whatsapp: ResultadoAvisosWhatsapp | { erro: string };
    try {
      whatsapp = await enviarAvisosWhatsapp();
    } catch (erro) {
      console.error("[cron/ciclo-de-vida] avisos do WhatsApp falharam:", erro instanceof Error ? erro.name : "erro");
      whatsapp = { erro: "falha" };
    }
    // Retenção da memória do assistente (24 h sem conversa). Falha aqui não derruba a rodada.
    const memoriasApagadas = await limparMemoriasVencidas().catch(() => {
      console.error("[cron/ciclo-de-vida] limpeza da memória do assistente falhou");
      return null;
    });
    return Response.json({ ok: true, ...resultado, whatsapp, memoriasApagadas }, { headers: { "Cache-Control": "no-store" } });
  } catch (erro) {
    console.error("[cron/ciclo-de-vida] falha:", erro instanceof Error ? erro.name : "erro");
    return Response.json({ ok: false, erro: "Falha ao processar." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}

export const GET = tratar;
export const POST = tratar;
