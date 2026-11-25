import "server-only";
import { lerConfigWhatsapp, type ConfigWhatsapp } from "./config";

// Envio de mensagens pelo provedor configurado (WAHA ou uazapi; ver ./config.ts). Nunca registra texto nem chat nos
// logs (têm dado pessoal).

export function configWhatsapp(): ConfigWhatsapp | null {
  return lerConfigWhatsapp(process.env);
}

export const sessaoWaha = (): string => process.env.WAHA_SESSION?.trim() || "default";

export class ErroWhatsapp extends Error {
  constructor(readonly status: number) {
    super(`Provedor de WhatsApp respondeu ${status}`);
    this.name = "ErroWhatsapp";
  }
}

/** Envia texto para um chat (o identificador que chegou na mensagem: telefone, @c.us, @s.whatsapp.net ou @lid). */
export async function enviarTexto(chatId: string, texto: string): Promise<void> {
  const cfg = configWhatsapp();
  if (!cfg) throw new ErroWhatsapp(503);

  const pedido: { caminho: string; cabecalhos: Record<string, string>; corpo: unknown } =
    cfg.provedor === "uazapi"
      ? { caminho: "/send/text", cabecalhos: { token: cfg.chave }, corpo: { number: chatId, text: texto } }
      : { caminho: "/api/sendText", cabecalhos: { "X-Api-Key": cfg.chave }, corpo: { session: cfg.sessao, chatId, text: texto } };

  const resposta = await fetch(`${cfg.url}${pedido.caminho}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...pedido.cabecalhos },
    body: JSON.stringify(pedido.corpo),
    signal: AbortSignal.timeout(15_000),
  });
  if (!resposta.ok) throw new ErroWhatsapp(resposta.status);
}
