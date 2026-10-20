import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { empresaAtivada, formatarTaxa, periodoValido, taxa, testeAmadurecido, testeConvertido } from "./formulas";

const agora = new Date("2026-10-20T15:00:00Z");

describe("taxa", () => {
  it("sem total não existe taxa (nunca 0%)", () => {
    assert.equal(taxa(0, 0), null);
    assert.equal(taxa(3, 0), null);
  });
  it("calcula parte sobre total e limita a 100%", () => {
    assert.equal(taxa(1, 4), 0.25);
    assert.equal(taxa(5, 4), 1);
    assert.equal(taxa(-1, 4), 0);
  });
  it("rejeita valores que não são número", () => {
    assert.equal(taxa(Number.NaN, 4), null);
    assert.equal(taxa(1, Number.POSITIVE_INFINITY), null);
  });
  it("formata em português", () => {
    assert.equal(formatarTaxa(null), "—");
    assert.equal(formatarTaxa(0.5), "50%");
    assert.equal(formatarTaxa(1 / 3), "33,3%");
  });
});

describe("período", () => {
  it("só aceita os períodos previstos", () => {
    assert.ok(periodoValido(7) && periodoValido(30) && periodoValido(90));
    assert.ok(!periodoValido(15) && !periodoValido("30") && !periodoValido(null));
  });
});

describe("ativação", () => {
  const vazio = { contas: 0, obras: 0, produtos: 0, compromissos: 0, perfilPublicado: false };
  it("só entrar não ativa", () => assert.equal(empresaAtivada(vazio), false));
  it("qualquer fato real ativa", () => {
    assert.ok(empresaAtivada({ ...vazio, obras: 1 }));
    assert.ok(empresaAtivada({ ...vazio, contas: 2 }));
    assert.ok(empresaAtivada({ ...vazio, produtos: 1 }));
    assert.ok(empresaAtivada({ ...vazio, compromissos: 1 }));
    assert.ok(empresaAtivada({ ...vazio, perfilPublicado: true }));
  });
});

describe("conversão do teste", () => {
  it("teste em andamento não amadureceu", () => {
    assert.equal(testeAmadurecido({ plano: "teste", testeTerminaEm: "2026-10-25T02:59:00.000Z" }, agora), false);
  });
  it("prazo vencido amadureceu, mesmo sem mudar de plano", () => {
    assert.equal(testeAmadurecido({ plano: "teste", testeTerminaEm: "2026-10-19T02:59:00.000Z" }, agora), true);
  });
  it("quem mudou de plano amadureceu", () => {
    assert.equal(testeAmadurecido({ plano: "ativo", testeTerminaEm: null }, agora), true);
    assert.equal(testeAmadurecido({ plano: "gratuito", testeTerminaEm: null }, agora), true);
  });
  it("teste sem data de fim não amadurece (dado incompleto não vira conversão nem perda)", () => {
    assert.equal(testeAmadurecido({ plano: "teste", testeTerminaEm: null }, agora), false);
  });
  it("só o plano ativo conta como convertido; cortesia não", () => {
    assert.equal(testeConvertido({ plano: "ativo", testeTerminaEm: null }), true);
    assert.equal(testeConvertido({ plano: "cortesia", testeTerminaEm: null }), false);
    assert.equal(testeConvertido({ plano: "teste", testeTerminaEm: null }), false);
  });
});
