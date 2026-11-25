import { numeroEloValido } from "./vinculo";

// Qual provedor de WhatsApp está ligado e com que credenciais. Puro (recebe o env) para dar para testar. Faltando
// qualquer variável do provedor escolhido, devolve null e o recurso fica DESLIGADO: nunca chuta um padrão.
//
//   WHATSAPP_PROVEDOR      "waha" (padrão) ou "uazapi". A API oficial da Meta entra aqui depois.
//   WHATSAPP_NUMERO_ELO    número do Elo com DDI, só dígitos (ex.: 5521985097600)
//   WAHA:   WAHA_URL, WAHA_API_KEY, WAHA_SESSION (padrão "default"), WAHA_WEBHOOK_HMAC_KEY (só na rota do webhook)
//   uazapi: UAZAPI_URL, UAZAPI_TOKEN (token da instância), UAZAPI_WEBHOOK_SEGREDO (só na rota do webhook)

export type ProvedorWhatsapp = "waha" | "uazapi";

export interface ConfigWhatsapp {
  provedor: ProvedorWhatsapp;
  /** URL base do provedor, sem barra no fim. */
  url: string;
  /** Chave da API (WAHA) ou token da instância (uazapi). */
  chave: string;
  /** Sessão do WAHA; vazio na uazapi (a instância vem do token). */
  sessao: string;
  numeroElo: string;
}

type Env = Record<string, string | undefined>;

function urlValida(bruta: string | undefined): string | null {
  const url = bruta?.trim().replace(/\/+$/, "");
  return url && /^https?:\/\//.test(url) ? url : null;
}

export function lerConfigWhatsapp(env: Env): ConfigWhatsapp | null {
  const provedor = (env.WHATSAPP_PROVEDOR?.trim().toLowerCase() || "waha") as string;
  const numeroElo = numeroEloValido(env.WHATSAPP_NUMERO_ELO);
  if (!numeroElo) return null;

  if (provedor === "waha") {
    const url = urlValida(env.WAHA_URL);
    const chave = env.WAHA_API_KEY?.trim();
    if (!url || !chave) return null;
    return { provedor, url, chave, sessao: env.WAHA_SESSION?.trim() || "default", numeroElo };
  }
  if (provedor === "uazapi") {
    const url = urlValida(env.UAZAPI_URL);
    const chave = env.UAZAPI_TOKEN?.trim();
    if (!url || !chave) return null;
    return { provedor, url, chave, sessao: "", numeroElo };
  }
  return null;
}
