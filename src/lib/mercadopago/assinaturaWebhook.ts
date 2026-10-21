import { createHmac, timingSafeEqual } from "node:crypto";

// Validação da assinatura dos webhooks do Mercado Pago (header x-signature). Separado do cliente HTTP porque é
// lógica pura (sem fetch, sem "server-only"), testável sem mockar rede.
//
// Formato de x-signature: "ts=<timestamp>,v1=<hmac hex>". O manifesto assinado é "id:<data.id minúsculo>;
// request-id:<x-request-id>;ts:<ts>;", omitindo id/request-id quando ausentes na notificação. O hash é
// HMAC-SHA256 do manifesto com a assinatura secreta configurada no painel do app (Suas integrações > Webhooks).
//
// Fail-closed, igual ao resto do projeto (CRON_SECRET, DOCUMENTOS_CHAVE): sem x-signature ou com assinatura que
// não bate, a notificação é recusada — nunca processada "sem certeza".

export interface CabecalhosWebhookMercadoPago {
  xSignature: string | null;
  xRequestId: string | null;
  /** data.id da query string da notificação, em qualquer caixa — a função normaliza para minúsculas. */
  dataId: string | null;
}

function partesDaAssinatura(xSignature: string): { ts: string | null; v1: string | null } {
  let ts: string | null = null;
  let v1: string | null = null;
  for (const parte of xSignature.split(",")) {
    const i = parte.indexOf("=");
    if (i === -1) continue;
    const chave = parte.slice(0, i).trim();
    const valor = parte.slice(i + 1).trim();
    if (chave === "ts") ts = valor;
    if (chave === "v1") v1 = valor;
  }
  return { ts, v1 };
}

/** Manifesto exigido pelo Mercado Pago para o HMAC; omite id/request-id quando a notificação não os traz. */
export function montarManifestoWebhook(cabecalhos: Pick<CabecalhosWebhookMercadoPago, "xRequestId" | "dataId">, ts: string): string {
  const partes: string[] = [];
  if (cabecalhos.dataId) partes.push(`id:${cabecalhos.dataId.toLowerCase()}`);
  if (cabecalhos.xRequestId) partes.push(`request-id:${cabecalhos.xRequestId}`);
  partes.push(`ts:${ts}`);
  return `${partes.join(";")};`;
}

/** true só quando a notificação foi mesmo assinada pelo Mercado Pago com este segredo. */
export function validarAssinaturaWebhook(cabecalhos: CabecalhosWebhookMercadoPago, segredo: string): boolean {
  if (!cabecalhos.xSignature) return false;
  const { ts, v1 } = partesDaAssinatura(cabecalhos.xSignature);
  if (!ts || !v1) return false;

  const manifesto = montarManifestoWebhook(cabecalhos, ts);
  const calculado = createHmac("sha256", segredo).update(manifesto).digest("hex");

  const a = Buffer.from(calculado, "hex");
  const b = Buffer.from(v1, "hex");
  if (a.length === 0 || a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export type TopicoWebhook = "assinatura" | "pagamento" | "cobranca_recorrente" | "ignorado";

/**
 * Tópico da notificação. Assinaturas chegam como "subscription_preapproval" (o "preapproval" é o nome do recurso na
 * API e o tópico do formato antigo, IPN); a cobrança de cada ciclo da assinatura chega como
 * "subscription_authorized_payment"; o pagamento avulso (o anual) como "payment". Qualquer outro tópico é ignorado.
 */
export function classificarTopico(tipo: string | null): TopicoWebhook {
  if (tipo === "subscription_preapproval" || tipo === "preapproval") return "assinatura";
  if (tipo === "payment") return "pagamento";
  if (tipo === "subscription_authorized_payment") return "cobranca_recorrente";
  return "ignorado";
}
