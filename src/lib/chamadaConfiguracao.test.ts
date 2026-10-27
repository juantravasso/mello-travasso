import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { configChamadaSchema, deveOferecerChamada, lerConfigChamada } from "./chamadaConfiguracao";

const ligada = { ativa: true, url: "https://cal.com/juan/20min" };
const agora = new Date("2026-10-26T12:00:00Z");

describe("configChamadaSchema", () => {
  it("aceita link https e desligado sem link", () => {
    assert.ok(configChamadaSchema.safeParse(ligada).success);
    assert.ok(configChamadaSchema.safeParse({ ativa: false, url: "" }).success);
  });
  it("recusa http, outros esquemas e texto solto", () => {
    for (const url of ["http://cal.com/x", "javascript:alert(1)", "cal.com/x", "https://a b.com"]) {
      assert.equal(configChamadaSchema.safeParse({ ativa: false, url }).success, false, url);
    }
  });
  it("não deixa ligar sem link", () => {
    assert.equal(configChamadaSchema.safeParse({ ativa: true, url: "" }).success, false);
  });
  it("campo desconhecido é recusado", () => {
    assert.equal(configChamadaSchema.safeParse({ ...ligada, extra: 1 }).success, false);
  });
});

describe("lerConfigChamada", () => {
  it("valor ausente ou inválido volta para desligado", () => {
    assert.deepEqual(lerConfigChamada(null), { ativa: false, url: "" });
    assert.deepEqual(lerConfigChamada({ ativa: true, url: "http://x" }), { ativa: false, url: "" });
  });
});

describe("deveOferecerChamada", () => {
  const base = { config: ligada, estado: null, criadaEm: "2026-10-20T00:00:00Z", agora };
  it("oferece a empresa recente que ainda não respondeu", () => {
    assert.equal(deveOferecerChamada(base), true);
  });
  it("não oferece com a função desligada", () => {
    assert.equal(deveOferecerChamada({ ...base, config: { ativa: false, url: ligada.url } }), false);
  });
  it("não oferece a quem já respondeu", () => {
    assert.equal(deveOferecerChamada({ ...base, estado: "agendada" }), false);
    assert.equal(deveOferecerChamada({ ...base, estado: "dispensada" }), false);
  });
  it("não oferece a empresa antiga", () => {
    assert.equal(deveOferecerChamada({ ...base, criadaEm: "2026-01-01T00:00:00Z" }), false);
  });
  it("data inválida não oferece", () => {
    assert.equal(deveOferecerChamada({ ...base, criadaEm: "ontem" }), false);
  });
});
