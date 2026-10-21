import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calcularStatusPlano } from "./plano";

describe("status do plano", () => {
  it("suspenso (assinatura cancelada, pausada ou vencida) é somente leitura", () => {
    const s = calcularStatusPlano({ plano: "suspenso", testeTerminaEm: null });
    assert.equal(s.somenteLeitura, true);
    assert.equal(s.diasRestantes, null);
  });
  it("ativo e cortesia não são somente leitura", () => {
    assert.equal(calcularStatusPlano({ plano: "ativo", testeTerminaEm: null }).somenteLeitura, false);
    assert.equal(calcularStatusPlano({ plano: "cortesia", testeTerminaEm: null }).somenteLeitura, false);
  });
  it("teste vencido é somente leitura e teste em andamento não", () => {
    const passado = new Date(Date.now() - 86_400_000).toISOString();
    const futuro = new Date(Date.now() + 5 * 86_400_000).toISOString();
    assert.equal(calcularStatusPlano({ plano: "teste", testeTerminaEm: passado }).somenteLeitura, true);
    assert.equal(calcularStatusPlano({ plano: "teste", testeTerminaEm: futuro }).somenteLeitura, false);
  });
});
