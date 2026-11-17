import "server-only";
import { numeroEloValido } from "./vinculo";

// Cliente do WAHA (WhatsApp HTTP API, hospedado por nós). Tudo vem de variáveis de ambiente; faltando qualquer uma, o
// recurso fica DESLIGADO (nunca chuta um padrão): a tela some o botão e nenhuma mensagem sai.
//   WAHA_URL                 ex.: https://waha.exemplo.com.br (sem barra no fim)
//   WAHA_API_KEY             chave do WAHA (cabeçalho X-Api-Key)
//   WAHA_WEBHOOK_HMAC_KEY    chave com que o WAHA assina os webhooks (HMAC-SHA512)
//   WAHA_SESSION             nome da sessão (padrão "default")
//   WHATSAPP_NUMERO_ELO      número do Elo com DDI, só dígitos (ex.: 5521985097600)

export interface ConfigWhatsapp {
  url: string;
  chave: string;
  sessao: string;
  numeroElo: string;
}

export function configWhatsapp(): ConfigWhatsapp | null {
  const url = process.env.WAHA_URL?.trim().replace(/\/+$/, "");
  const chave = process.env.WAHA_API_KEY?.trim();
  const numeroElo = numeroEloValido(process.env.WHATSAPP_NUMERO_ELO);
  if (!url || !/^https?:\/\//.test(url) || !chave || !numeroElo) return null;
  return { url, chave, sessao: process.env.WAHA_SESSION?.trim() || "default", numeroElo };
}

export const sessaoWaha = (): string => process.env.WAHA_SESSION?.trim() || "default";

export class ErroWaha extends Error {
  constructor(readonly status: number) {
    super(`WAHA respondeu ${status}`);
    this.name = "ErroWaha";
  }
}

/** Envia texto para um chat. Nunca registra o texto nem o chat nos logs (têm dado pessoal). */
export async function enviarTexto(chatId: string, texto: string): Promise<void> {
  const cfg = configWhatsapp();
  if (!cfg) throw new ErroWaha(503);
  const resposta = await fetch(`${cfg.url}/api/sendText`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Key": cfg.chave },
    body: JSON.stringify({ session: cfg.sessao, chatId, text: texto }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!resposta.ok) throw new ErroWaha(resposta.status);
}
