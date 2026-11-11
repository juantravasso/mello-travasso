import "server-only";

// Cliente mínimo para a API REST do Mercado Pago, sem SDK — mesmo padrão do envio de e-mail via Resend em
// src/lib/email/enviar.server.ts (fetch direto, timeout explícito, sem retry automático embutido).
// Nunca loga o corpo da resposta de erro: pode trazer dado do pagador.

const BASE_URL = "https://api.mercadopago.com";
const TEMPO_LIMITE_MS = 10_000;

export class ErroMercadoPago extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function tokenDeAcesso(): string {
  const valor = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!valor) throw new ErroMercadoPago(503, "Pagamento indisponível: Mercado Pago não configurado.");
  return valor;
}

async function chamar<T>(caminho: string, opcoes: { method: "GET" | "POST"; corpo?: unknown; chaveIdempotencia?: string }): Promise<T> {
  let resposta: Response;
  try {
    resposta = await fetch(`${BASE_URL}${caminho}`, {
      method: opcoes.method,
      headers: {
        Authorization: `Bearer ${tokenDeAcesso()}`,
        "Content-Type": "application/json",
        ...(opcoes.chaveIdempotencia ? { "X-Idempotency-Key": opcoes.chaveIdempotencia } : {}),
      },
      body: opcoes.corpo ? JSON.stringify(opcoes.corpo) : undefined,
      signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
    });
  } catch (erro) {
    throw new ErroMercadoPago(0, `Falha ao chamar o Mercado Pago: ${erro instanceof Error ? erro.name : "erro"}.`);
  }
  if (!resposta.ok) throw new ErroMercadoPago(resposta.status, `Mercado Pago recusou a chamada (status ${resposta.status}).`);
  return (await resposta.json()) as T;
}

export interface PreapprovalCriado {
  id: string;
  init_point: string;
  status: string;
}

export interface PreferenciaCriada {
  id: string;
  init_point: string;
}

export interface PagamentoPixCriado {
  id: number;
  status: string;
  point_of_interaction?: { transaction_data?: { qr_code?: string; qr_code_base64?: string; ticket_url?: string } };
}

export interface PagamentoConsultado {
  id: number;
  status: string;
  external_reference: string | null;
  transaction_amount: number;
}

export interface PreapprovalConsultado {
  id: string;
  status: string;
  external_reference: string | null;
}

/** Cria a assinatura recorrente mensal (cobrança de valor fixo por ciclo; não aceita parcelamento). */
export async function criarPreapproval(args: {
  motivo: string;
  externalReference: string;
  valorCentavos: number;
  payerEmail: string;
  backUrl: string;
  chaveIdempotencia: string;
}): Promise<PreapprovalCriado> {
  return chamar<PreapprovalCriado>("/preapproval", {
    method: "POST",
    chaveIdempotencia: args.chaveIdempotencia,
    corpo: {
      reason: args.motivo,
      external_reference: args.externalReference,
      payer_email: args.payerEmail,
      back_url: args.backUrl,
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: args.valorCentavos / 100,
        currency_id: "BRL",
      },
    },
  });
}

/**
 * Cria a preferência de pagamento único do anual (Checkout Pro): só cartão de crédito, em até 12x com os juros do
 * cartão (o Pix tem fluxo próprio, dentro do site). Quem paga os juros é o cliente.
 */
export async function criarPreferenciaAnual(args: {
  titulo: string;
  externalReference: string;
  valorCentavos: number;
  payerEmail: string;
  backUrls: { success: string; failure: string; pending: string };
  chaveIdempotencia: string;
}): Promise<PreferenciaCriada> {
  return chamar<PreferenciaCriada>("/checkout/preferences", {
    method: "POST",
    chaveIdempotencia: args.chaveIdempotencia,
    corpo: {
      items: [{ title: args.titulo, quantity: 1, unit_price: args.valorCentavos / 100, currency_id: "BRL" }],
      external_reference: args.externalReference,
      payer: { email: args.payerEmail },
      payment_methods: { installments: 12, excluded_payment_types: [{ id: "bank_transfer" }, { id: "ticket" }, { id: "debit_card" }] },
      back_urls: args.backUrls,
      auto_return: "approved",
    },
  });
}

/** Cria um pagamento por Pix. O QR e o "copia e cola" voltam na resposta, para mostrar dentro do site. */
export async function criarPagamentoPix(args: {
  descricao: string;
  externalReference: string;
  valorCentavos: number;
  payerEmail: string;
  expiraEm: Date;
  chaveIdempotencia: string;
}): Promise<PagamentoPixCriado> {
  return chamar<PagamentoPixCriado>("/v1/payments", {
    method: "POST",
    chaveIdempotencia: args.chaveIdempotencia,
    corpo: {
      transaction_amount: args.valorCentavos / 100,
      description: args.descricao,
      payment_method_id: "pix",
      external_reference: args.externalReference,
      payer: { email: args.payerEmail },
      date_of_expiration: args.expiraEm.toISOString().replace("Z", "+00:00"),
    },
  });
}

export async function consultarPagamento(id: string): Promise<PagamentoConsultado> {
  return chamar<PagamentoConsultado>(`/v1/payments/${id}`, { method: "GET" });
}

export async function consultarPreapproval(id: string): Promise<PreapprovalConsultado> {
  return chamar<PreapprovalConsultado>(`/preapproval/${id}`, { method: "GET" });
}
