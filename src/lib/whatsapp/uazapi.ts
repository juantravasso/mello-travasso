import { createHash, timingSafeEqual } from "node:crypto";
import { ehChatIndividual, numeroDoChat, type MensagemRecebida, type MidiaRecebida } from "./vinculo";

// Leitura do webhook da uazapi. A uazapi NÃO assina o webhook: o corpo traz o token da instância, e a URL cadastrada
// leva um segredo nosso no caminho. A rota exige os dois (ver src/app/api/webhooks/uazapi/[segredo]/route.ts).

/** Compara dois segredos em tempo constante (o hash iguala os tamanhos). Vazio nunca confere. */
export function segredoConfere(recebido: string | null | undefined, esperado: string | null | undefined): boolean {
  if (!recebido || !esperado) return false;
  const a = createHash("sha256").update(recebido).digest();
  const b = createHash("sha256").update(esperado).digest();
  return timingSafeEqual(a, b);
}

/** Token da instância que veio no corpo do webhook (para conferir com UAZAPI_TOKEN). */
export function tokenDoWebhookUazapi(corpo: unknown): string | null {
  if (!corpo || typeof corpo !== "object") return null;
  const t = (corpo as Record<string, unknown>).token;
  return typeof t === "string" ? t : null;
}

/**
 * Mensagem recebida de outra pessoa, em conversa individual, que não foi enviada pela própria API. Qualquer outro
 * evento (status, conexão, grupo, mensagem nossa) devolve null.
 */
export function lerMensagemUazapi(corpo: unknown): MensagemRecebida | null {
  if (!corpo || typeof corpo !== "object") return null;
  const c = corpo as Record<string, unknown>;
  if (c.EventType !== "messages") return null;
  const bruta = c.message;
  if (!bruta || typeof bruta !== "object") return null;
  const m = bruta as Record<string, unknown>;
  if (m.fromMe === true || m.wasSentByApi === true || m.isGroup === true) return null;

  const chatId = typeof m.chatid === "string" ? m.chatid : null;
  if (!chatId || !ehChatIndividual(chatId)) return null;
  const texto = typeof m.text === "string" ? m.text : "";
  const alternativo = typeof m.sender_pn === "string" ? numeroDoChat(m.sender_pn) : null;
  const mensagemId = typeof m.messageid === "string" ? m.messageid : null;
  return { chatId, texto, numero: numeroDoChat(chatId) ?? alternativo, mensagemId, midia: midiaUazapi(m) };
}

/**
 * Mensagem que um ATENDENTE digitou no próprio aparelho, numa conversa individual (fromMe, mas não enviada pela API).
 * Devolve o chat, para o assistente ficar quieto nele por 2 h. O webhook é cadastrado sem as mensagens da API
 * (excludeMessages: wasSentByApi); a conferência de wasSentByApi aqui é a segunda barreira.
 */
export function chatRespondidoPeloAtendente(corpo: unknown): string | null {
  if (!corpo || typeof corpo !== "object") return null;
  const c = corpo as Record<string, unknown>;
  if (c.EventType !== "messages" || !c.message || typeof c.message !== "object") return null;
  const m = c.message as Record<string, unknown>;
  if (m.fromMe !== true || m.wasSentByApi === true || m.isGroup === true) return null;
  const chatId = typeof m.chatid === "string" ? m.chatid : null;
  return chatId && ehChatIndividual(chatId) ? chatId : null;
}

/**
 * A documentação da uazapi só mostra o exemplo de texto ("Conversation"); o tipo de foto é inferido pelo nome
 * ("ImageMessage", "image"...). Conferir no primeiro teste real.
 */
function midiaUazapi(m: Record<string, unknown>): MidiaRecebida | null {
  const tipo = [m.messageType, m.mediaType].filter((v): v is string => typeof v === "string").join(" ").toLowerCase();
  if (!tipo || /conversation|extendedtext|^text/.test(tipo)) return null;
  if (!/image|video|audio|document|sticker|ptt/.test(tipo)) return null;
  const content = m.content && typeof m.content === "object" ? (m.content as Record<string, unknown>) : {};
  const mimetype = typeof content.mimetype === "string" ? content.mimetype : null;
  return { tipo: /image/.test(tipo) && !/sticker/.test(tipo) ? "imagem" : "outra", url: null, mimetype };
}
