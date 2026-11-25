import assert from "node:assert/strict";
import { test } from "node:test";
import { lerConfigWhatsapp } from "./config";
import { lerMensagemUazapi, segredoConfere, tokenDoWebhookUazapi } from "./uazapi";

// Exemplo de webhook da documentação da uazapi (identificadores fictícios).
const exemplo = {
  EventType: "messages",
  owner: "5511999999999",
  token: "INSTANCE_TOKEN",
  BaseUrl: "https://seu-servidor.example",
  instanceName: "Atendimento",
  message: {
    id: "5511999999999:MSG_EXEMPLO",
    messageid: "MSG_EXEMPLO",
    chatid: "5511888888888@s.whatsapp.net",
    sender: "5511888888888@s.whatsapp.net",
    senderName: "Contato de exemplo",
    fromMe: false,
    isGroup: false,
    messageType: "Conversation",
    text: "VINCULAR ABCD2345",
    messageTimestamp: 1788868800000,
  },
};
const comMensagem = (m: Record<string, unknown>) => ({ ...exemplo, message: { ...exemplo.message, ...m } });

test("lerMensagemUazapi lê a mensagem de texto do exemplo da documentação", () => {
  assert.deepEqual(lerMensagemUazapi(exemplo), { chatId: "5511888888888@s.whatsapp.net", texto: "VINCULAR ABCD2345", numero: "5511888888888" });
});

test("lerMensagemUazapi ignora o que não é mensagem de outra pessoa em conversa individual", () => {
  assert.equal(lerMensagemUazapi({ ...exemplo, EventType: "messages_update" }), null);
  assert.equal(lerMensagemUazapi({ ...exemplo, EventType: "connection" }), null);
  assert.equal(lerMensagemUazapi(comMensagem({ fromMe: true })), null, "mensagem nossa");
  assert.equal(lerMensagemUazapi(comMensagem({ wasSentByApi: true })), null, "enviada pela API");
  assert.equal(lerMensagemUazapi(comMensagem({ isGroup: true, chatid: "120363@g.us" })), null, "grupo");
  assert.equal(lerMensagemUazapi(comMensagem({ chatid: "120363@newsletter" })), null, "canal");
  assert.equal(lerMensagemUazapi({ EventType: "messages" }), null);
  assert.equal(lerMensagemUazapi(null), null);
});

test("lerMensagemUazapi: @lid fica sem número, a não ser que venha sender_pn", () => {
  const lid = comMensagem({ chatid: "99887766@lid", sender: "99887766@lid" });
  assert.deepEqual(lerMensagemUazapi(lid), { chatId: "99887766@lid", texto: "VINCULAR ABCD2345", numero: null });
  const comPn = comMensagem({ chatid: "99887766@lid", sender_pn: "5521977776666@s.whatsapp.net" });
  assert.equal(lerMensagemUazapi(comPn)?.numero, "5521977776666");
});

test("mensagem sem texto (foto sem legenda) chega com texto vazio", () => {
  assert.equal(lerMensagemUazapi(comMensagem({ text: undefined, messageType: "ImageMessage" }))?.texto, "");
});

test("token do corpo e segredo da URL conferem em tempo constante e nunca com vazio", () => {
  assert.equal(tokenDoWebhookUazapi(exemplo), "INSTANCE_TOKEN");
  assert.equal(tokenDoWebhookUazapi({}), null);
  assert.equal(segredoConfere("abc", "abc"), true);
  assert.equal(segredoConfere("abc", "abd"), false);
  assert.equal(segredoConfere("", ""), false);
  assert.equal(segredoConfere(null, "abc"), false);
  assert.equal(segredoConfere("abc", undefined), false);
});

test("lerConfigWhatsapp escolhe o provedor e desliga quando falta algo", () => {
  const numero = { WHATSAPP_NUMERO_ELO: "5521985097600" };
  assert.deepEqual(lerConfigWhatsapp({ ...numero, WHATSAPP_PROVEDOR: "uazapi", UAZAPI_URL: "https://x.uazapi.com/", UAZAPI_TOKEN: "t" }), {
    provedor: "uazapi",
    url: "https://x.uazapi.com",
    chave: "t",
    sessao: "",
    numeroElo: "5521985097600",
  });
  assert.equal(lerConfigWhatsapp({ ...numero, WHATSAPP_PROVEDOR: "uazapi", UAZAPI_URL: "https://x.uazapi.com" }), null, "sem token");
  assert.equal(lerConfigWhatsapp({ WHATSAPP_PROVEDOR: "uazapi", UAZAPI_URL: "https://x.uazapi.com", UAZAPI_TOKEN: "t" }), null, "sem número do Elo");
  assert.equal(lerConfigWhatsapp({ ...numero, WHATSAPP_PROVEDOR: "outro", UAZAPI_URL: "https://x", UAZAPI_TOKEN: "t" }), null, "provedor desconhecido");
  assert.equal(lerConfigWhatsapp({ ...numero, WHATSAPP_PROVEDOR: "uazapi", UAZAPI_URL: "ftp://x", UAZAPI_TOKEN: "t" }), null, "URL inválida");
  assert.equal(lerConfigWhatsapp({ ...numero, WAHA_URL: "https://waha.x", WAHA_API_KEY: "k" })?.provedor, "waha", "padrão continua WAHA");
});
