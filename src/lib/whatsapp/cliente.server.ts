import "server-only";
import { lerConfigWhatsapp, type ConfigWhatsapp } from "./config";
import type { MensagemRecebida } from "./vinculo";

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

export interface MidiaBaixada {
  base64: string;
  mimetype: string;
  bytes: number;
}

/**
 * Baixa a mídia de uma mensagem. uazapi: POST /message/download pelo id, pedindo base64 (evita buscar URL de CDN de
 * terceiros). WAHA: GET na URL da mídia com a chave da API. Recusa acima de `limiteBytes` sem guardar o excesso.
 */
export async function baixarMidia(mensagem: MensagemRecebida, limiteBytes: number): Promise<MidiaBaixada> {
  const cfg = configWhatsapp();
  if (!cfg) throw new ErroWhatsapp(503);

  if (cfg.provedor === "uazapi") {
    if (!mensagem.mensagemId) throw new ErroWhatsapp(400);
    const r = await fetch(`${cfg.url}/message/download`, {
      method: "POST",
      headers: { "Content-Type": "application/json", token: cfg.chave },
      body: JSON.stringify({ id: mensagem.mensagemId, return_base64: true, return_link: false }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!r.ok) throw new ErroWhatsapp(r.status);
    const corpo = (await r.json()) as { base64Data?: unknown; mimetype?: unknown };
    if (typeof corpo.base64Data !== "string") throw new ErroWhatsapp(502);
    const base64 = corpo.base64Data.includes(",") ? corpo.base64Data.slice(corpo.base64Data.indexOf(",") + 1) : corpo.base64Data;
    const bytes = Math.floor((base64.length * 3) / 4);
    if (bytes > limiteBytes) throw new ErroWhatsapp(413);
    const mimetype = typeof corpo.mimetype === "string" ? corpo.mimetype.split(";")[0].trim() : (mensagem.midia?.mimetype ?? "");
    return { base64, mimetype, bytes };
  }

  const url = mensagem.midia?.url;
  // A URL vem do próprio WAHA: só baixa se for do mesmo servidor (evita a chave da API ir para outro host).
  if (!url || new URL(url).origin !== new URL(cfg.url).origin) throw new ErroWhatsapp(400);
  const r = await fetch(url, { headers: { "X-Api-Key": cfg.chave }, signal: AbortSignal.timeout(30_000) });
  if (!r.ok) throw new ErroWhatsapp(r.status);
  const tamanho = Number(r.headers.get("content-length") ?? "0");
  if (tamanho > limiteBytes) throw new ErroWhatsapp(413);
  const buffer = Buffer.from(await r.arrayBuffer());
  if (buffer.byteLength > limiteBytes) throw new ErroWhatsapp(413);
  const mimetype = (r.headers.get("content-type") ?? mensagem.midia?.mimetype ?? "").split(";")[0].trim();
  return { base64: buffer.toString("base64"), mimetype, bytes: buffer.byteLength };
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
