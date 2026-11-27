import { chatRespondidoPeloAtendente, lerMensagemUazapi, segredoConfere, tokenDoWebhookUazapi } from "@/lib/whatsapp/uazapi";
import { atendenteRespondeu } from "@/services/data/server/assistente/assistenteCore.server";
import { responderMensagemRecebida } from "@/services/data/server/whatsappWebhook.server";

// Recebe as mensagens do WhatsApp pela uazapi. A uazapi não assina o webhook, então a rota exige DUAS provas:
//   1. o segredo no caminho (/api/webhooks/uazapi/<UAZAPI_WEBHOOK_SEGREDO>), que só a uazapi conhece;
//   2. o token da instância no corpo, igual a UAZAPI_TOKEN.
// Faltando qualquer das duas variáveis, a rota fica fechada (503). Responde 404 a segredo errado (não confirma que a
// rota existe). Nada de conteúdo de mensagem vai para o log.
//
// A uazapi não reenvia webhook que falhou e desliga o webhook depois de 24 h com 10+ falhas. Por isso tudo que não é
// para nós (evento, grupo, corpo estranho) volta 200, e só falha real nossa volta 500: a mensagem perdida é reenviada
// pela pessoa (o vínculo é idempotente).

export const dynamic = "force-dynamic";
// 60 s: a leitura da foto pela IA roda depois da resposta (after) e conta neste limite.
export const maxDuration = 60;

const SEM_CACHE = { "Cache-Control": "no-store" };
const TAMANHO_MAXIMO = 256 * 1024;

export async function POST(request: Request, contexto: { params: Promise<{ segredo: string }> }): Promise<Response> {
  const segredoEsperado = process.env.UAZAPI_WEBHOOK_SEGREDO;
  const tokenEsperado = process.env.UAZAPI_TOKEN;
  if (!segredoEsperado || !tokenEsperado) {
    console.error("[webhooks/uazapi] UAZAPI_WEBHOOK_SEGREDO ou UAZAPI_TOKEN ausente: rota fechada.");
    return Response.json({ ok: false, erro: "Webhook não configurado." }, { status: 503, headers: SEM_CACHE });
  }

  const { segredo } = await contexto.params;
  if (!segredoConfere(segredo, segredoEsperado)) return new Response(null, { status: 404, headers: SEM_CACHE });

  const corpoBruto = await request.text();
  if (corpoBruto.length > TAMANHO_MAXIMO) return Response.json({ ok: false }, { status: 413, headers: SEM_CACHE });

  let corpo: unknown;
  try {
    corpo = JSON.parse(corpoBruto);
  } catch {
    return Response.json({ ok: true, ignorado: "corpo ilegível" }, { headers: SEM_CACHE });
  }
  if (!segredoConfere(tokenDoWebhookUazapi(corpo), tokenEsperado)) {
    return Response.json({ ok: false, erro: "Não autorizado." }, { status: 401, headers: SEM_CACHE });
  }

  // Atendente respondeu pelo aparelho: o assistente fica quieto nesta conversa por 2 h.
  const atendido = chatRespondidoPeloAtendente(corpo);
  if (atendido) {
    await atendenteRespondeu(atendido).catch(() => console.error("[webhooks/uazapi] atendimento humano não registrado"));
    return Response.json({ ok: true }, { headers: SEM_CACHE });
  }

  const mensagem = lerMensagemUazapi(corpo);
  if (!mensagem) return Response.json({ ok: true, ignorado: "evento não tratado" }, { headers: SEM_CACHE });

  try {
    await responderMensagemRecebida(mensagem, "uazapi");
    return Response.json({ ok: true }, { headers: SEM_CACHE });
  } catch (erro) {
    console.error("[webhooks/uazapi] falha ao processar:", erro instanceof Error ? erro.name : "erro");
    return Response.json({ ok: false, erro: "Falha ao processar." }, { status: 500, headers: SEM_CACHE });
  }
}
