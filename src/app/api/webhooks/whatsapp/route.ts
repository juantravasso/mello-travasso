import { assinaturaWahaConfere, lerMensagemWaha } from "@/lib/whatsapp/vinculo";
import { enviarTexto, sessaoWaha } from "@/lib/whatsapp/waha.server";
import { tratarMensagemRecebida } from "@/services/data/server/whatsappCore.server";

// Recebe as mensagens do WhatsApp pelo WAHA. Autenticação: o WAHA assina o corpo com HMAC-SHA512 (X-Webhook-Hmac) usando
// WAHA_WEBHOOK_HMAC_KEY; sem a chave a rota fica fechada (503), nunca aberta. A assinatura é conferida sobre o corpo
// BRUTO, antes de qualquer leitura do JSON.
//
// Só uma mensagem faz algo: "VINCULAR <código>" (prova de que a pessoa controla o número). O resto da conversa é
// ignorado, porque o mesmo número também atende suporte por pessoas. Nada de conteúdo de mensagem vai para o log.

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const SEM_CACHE = { "Cache-Control": "no-store" };
const TAMANHO_MAXIMO = 256 * 1024;

const RESPOSTAS = {
  vinculado: (nome: string) =>
    `Pronto${nome ? `, ${nome}` : ""}! Seu WhatsApp está vinculado ao Elo Negócios. Você vai receber por aqui os avisos da sua conta, e pode desligar quando quiser em Configurações.`,
  codigo_invalido: "Esse código não vale mais ou não existe. Gere um novo em Configurações, no Elo Negócios, e envie de novo.",
  chat_em_uso: "Este WhatsApp já está vinculado a outra conta do Elo Negócios. Para usar nesta, desvincule na outra em Configurações.",
} as const;

export async function POST(request: Request): Promise<Response> {
  const chave = process.env.WAHA_WEBHOOK_HMAC_KEY;
  if (!chave) {
    console.error("[webhooks/whatsapp] WAHA_WEBHOOK_HMAC_KEY ausente: rota fechada.");
    return Response.json({ ok: false, erro: "Webhook não configurado." }, { status: 503, headers: SEM_CACHE });
  }

  const corpoBruto = await request.text();
  if (corpoBruto.length > TAMANHO_MAXIMO) return Response.json({ ok: false }, { status: 413, headers: SEM_CACHE });
  if (!assinaturaWahaConfere(corpoBruto, request.headers.get("x-webhook-hmac"), chave)) {
    return Response.json({ ok: false, erro: "Assinatura inválida." }, { status: 401, headers: SEM_CACHE });
  }

  let corpo: unknown;
  try {
    corpo = JSON.parse(corpoBruto);
  } catch {
    return Response.json({ ok: true, ignorado: "corpo ilegível" }, { headers: SEM_CACHE });
  }

  const mensagem = lerMensagemWaha(corpo, sessaoWaha());
  if (!mensagem) return Response.json({ ok: true, ignorado: "evento não tratado" }, { headers: SEM_CACHE });

  try {
    const resultado = await tratarMensagemRecebida(mensagem);
    if (resultado.tipo !== "ignorada") {
      const texto = resultado.tipo === "vinculado" ? RESPOSTAS.vinculado(resultado.primeiroNome) : RESPOSTAS[resultado.tipo];
      // A resposta é cortesia: se o WAHA falhar, o vínculo já foi gravado e o webhook não precisa ser repetido.
      await enviarTexto(mensagem.chatId, texto).catch((e) => console.error("[webhooks/whatsapp] resposta não enviada:", e instanceof Error ? e.name : "erro"));
    }
    return Response.json({ ok: true }, { headers: SEM_CACHE });
  } catch (erro) {
    console.error("[webhooks/whatsapp] falha ao processar:", erro instanceof Error ? erro.name : "erro");
    return Response.json({ ok: false, erro: "Falha ao processar." }, { status: 500, headers: SEM_CACHE });
  }
}
