import "server-only";
import webpush from "web-push";
import { MARCA } from "@/lib/marca";
import type { PayloadPush } from "./payload";

// Envio de notificação push (Web Push, protocolo VAPID). Sem as duas chaves o recurso fica desligado (o botão some da
// tela). Gere o par com: npx web-push generate-vapid-keys

// As chaves são lidas a cada uso (não ao carregar o módulo) para os testes poderem ligar e desligar o recurso.
const chavePublica = () => process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() ?? "";
const chavePrivada = () => process.env.VAPID_PRIVATE_KEY?.trim() ?? "";

/** Quanto tempo o serviço de push guarda a mensagem se o aparelho estiver desligado. Lembrete velho não serve. */
const VALIDADE_SEGUNDOS = 6 * 60 * 60;

export function pushConfigurado(): boolean {
  return chavePublica().length > 0 && chavePrivada().length > 0;
}

export interface Inscricao {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** ok = entregue ao serviço de push; expirada = o aparelho não existe mais (apagar); falha = tentar de novo depois. */
export type ResultadoPush = "ok" | "expirada" | "falha";

export async function enviarPush(inscricao: Inscricao, payload: PayloadPush): Promise<ResultadoPush> {
  if (!pushConfigurado()) return "falha";
  try {
    await webpush.sendNotification({ endpoint: inscricao.endpoint, keys: { p256dh: inscricao.p256dh, auth: inscricao.auth } }, JSON.stringify(payload), {
      TTL: VALIDADE_SEGUNDOS,
      vapidDetails: { subject: `mailto:${MARCA.emailContato}`, publicKey: chavePublica(), privateKey: chavePrivada() },
    });
    return "ok";
  } catch (erro) {
    const status = typeof erro === "object" && erro !== null && "statusCode" in erro ? Number((erro as { statusCode: unknown }).statusCode) : 0;
    if (status === 404 || status === 410) return "expirada";
    // Só o código: nada de endpoint ou chave em log.
    console.error("[push] falha ao enviar:", status || (erro instanceof Error ? erro.name : "erro"));
    return "falha";
  }
}
