import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { describe, it } from "node:test";
import { montarManifestoWebhook, validarAssinaturaWebhook } from "./assinaturaWebhook";

const SEGREDO = "segredo-de-teste";

function assinar(manifesto: string, segredo = SEGREDO): string {
  return createHmac("sha256", segredo).update(manifesto).digest("hex");
}

describe("montarManifestoWebhook", () => {
  it("inclui id e request-id em minúsculas quando presentes", () => {
    assert.equal(montarManifestoWebhook({ dataId: "ORD01JQXYZ", xRequestId: "req-123" }, "1700000000"), "id:ord01jqxyz;request-id:req-123;ts:1700000000;");
  });

  it("omite id e request-id quando ausentes na notificação", () => {
    assert.equal(montarManifestoWebhook({ dataId: null, xRequestId: null }, "1700000000"), "ts:1700000000;");
  });
});

describe("validarAssinaturaWebhook", () => {
  it("aceita uma assinatura calculada corretamente", () => {
    const ts = "1700000000";
    const cabecalhos = { dataId: "123456789", xRequestId: "req-abc", xSignature: "" };
    const manifesto = montarManifestoWebhook(cabecalhos, ts);
    const v1 = assinar(manifesto);
    assert.equal(validarAssinaturaWebhook({ ...cabecalhos, xSignature: `ts=${ts},v1=${v1}` }, SEGREDO), true);
  });

  it("recusa quando o segredo usado para assinar é outro", () => {
    const ts = "1700000000";
    const cabecalhos = { dataId: "123456789", xRequestId: "req-abc" };
    const manifesto = montarManifestoWebhook(cabecalhos, ts);
    const v1 = assinar(manifesto, "outro-segredo");
    assert.equal(validarAssinaturaWebhook({ ...cabecalhos, xSignature: `ts=${ts},v1=${v1}` }, SEGREDO), false);
  });

  it("recusa quando o corpo foi adulterado (data.id diferente do assinado)", () => {
    const ts = "1700000000";
    const manifesto = montarManifestoWebhook({ dataId: "123456789", xRequestId: "req-abc" }, ts);
    const v1 = assinar(manifesto);
    assert.equal(validarAssinaturaWebhook({ dataId: "999999999", xRequestId: "req-abc", xSignature: `ts=${ts},v1=${v1}` }, SEGREDO), false);
  });

  it("recusa sem header x-signature", () => {
    assert.equal(validarAssinaturaWebhook({ dataId: "1", xRequestId: "r", xSignature: null }, SEGREDO), false);
  });

  it("recusa x-signature sem ts ou v1", () => {
    assert.equal(validarAssinaturaWebhook({ dataId: "1", xRequestId: "r", xSignature: "ts=1700000000" }, SEGREDO), false);
    assert.equal(validarAssinaturaWebhook({ dataId: "1", xRequestId: "r", xSignature: "v1=abc" }, SEGREDO), false);
  });

  it("recusa v1 com tamanho diferente do hash calculado (sem lançar)", () => {
    assert.equal(validarAssinaturaWebhook({ dataId: "1", xRequestId: "r", xSignature: "ts=1700000000,v1=abc" }, SEGREDO), false);
  });
});

describe("classificarTopico", () => {
  it("assinaturas chegam como subscription_preapproval (e preapproval no formato antigo)", async () => {
    const { classificarTopico } = await import("./assinaturaWebhook");
    assert.equal(classificarTopico("subscription_preapproval"), "assinatura");
    assert.equal(classificarTopico("preapproval"), "assinatura");
  });
  it("pagamento avulso, cobrança recorrente e o resto", async () => {
    const { classificarTopico } = await import("./assinaturaWebhook");
    assert.equal(classificarTopico("payment"), "pagamento");
    assert.equal(classificarTopico("subscription_authorized_payment"), "cobranca_recorrente");
    assert.equal(classificarTopico("subscription_preapproval_plan"), "ignorado");
    assert.equal(classificarTopico("merchant_order"), "ignorado");
    assert.equal(classificarTopico(null), "ignorado");
  });
});
