import { consultarPagamento, consultarPreapproval, ErroMercadoPago } from "@/lib/mercadopago/cliente.server";
import { classificarTopico, validarAssinaturaWebhook } from "@/lib/mercadopago/assinaturaWebhook";
import { confirmarAssinaturaMensal, confirmarPagamentoAnual, registrarWebhookProcessado } from "@/services/data/server/assinaturaComercialCore.server";

// Recebe as notificações do Mercado Pago (preapproval = assinatura mensal; payment = cobrança avulsa, inclui o
// anual parcelado). Autenticação por assinatura de payload (x-signature), não por segredo fixo — ver
// src/lib/mercadopago/assinaturaWebhook.ts. Sem MERCADOPAGO_WEBHOOK_SECRET configurado, a rota fica fechada (503),
// nunca aberta, mesmo padrão de /api/cron/lembretes.
//
// Nunca confia no corpo da notificação para decidir o que mudou: sempre consulta a API do Mercado Pago de novo
// pelo id recebido e age sobre o estado ATUAL. Por isso notificações repetidas ou fora de ordem são inofensivas (as
// confirmações são idempotentes pelo estado) e NÃO se descarta uma notificação só porque o id já apareceu: o mesmo
// pagamento ou assinatura muda de estado várias vezes. A auditoria é gravada depois de processar com sucesso; erro
// inesperado devolve 500 sem gravar nada, e o Mercado Pago tenta de novo.

export const dynamic = "force-dynamic";
export const maxDuration = 30;

async function tratar(request: Request): Promise<Response> {
  const segredo = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!segredo) {
    console.error("[webhooks/mercadopago] MERCADOPAGO_WEBHOOK_SECRET ausente: rota fechada.");
    return Response.json({ ok: false, erro: "Webhook não configurado." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  const url = new URL(request.url);
  const tipo = url.searchParams.get("type") ?? url.searchParams.get("topic");
  const dataId = url.searchParams.get("data.id") ?? url.searchParams.get("id");
  const assinaturaValida = validarAssinaturaWebhook(
    { xSignature: request.headers.get("x-signature"), xRequestId: request.headers.get("x-request-id"), dataId },
    segredo,
  );
  if (!assinaturaValida) {
    return Response.json({ ok: false, erro: "Assinatura inválida." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const topico = classificarTopico(tipo);
  if (!tipo || !dataId || topico === "ignorado") {
    return Response.json({ ok: true, ignorado: "tópico ou id não tratado" }, { headers: { "Cache-Control": "no-store" } });
  }

  try {
    let estado: string;
    if (topico === "assinatura") {
      const preapproval = await consultarPreapproval(dataId);
      estado = preapproval.status;
      if (preapproval.external_reference) await confirmarAssinaturaMensal(preapproval.external_reference, preapproval.id, preapproval.status);
    } else if (topico === "pagamento") {
      const pagamento = await consultarPagamento(dataId);
      estado = pagamento.status;
      if (pagamento.external_reference) await confirmarPagamentoAnual(pagamento.external_reference, String(pagamento.id), pagamento.status);
    } else {
      // Cobrança de um ciclo da assinatura mensal: o estado da assinatura chega no tópico de assinatura, então aqui só
      // fica a trilha (cada cobrança aparece na auditoria).
      estado = "ciclo";
    }
    await registrarWebhookProcessado(tipo, dataId, estado);
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (erro) {
    const status = erro instanceof ErroMercadoPago ? erro.status : undefined;
    console.error("[webhooks/mercadopago] falha ao processar:", erro instanceof Error ? erro.name : "erro", status ?? "");
    return Response.json({ ok: false, erro: "Falha ao processar." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}

export const GET = tratar;
export const POST = tratar;
