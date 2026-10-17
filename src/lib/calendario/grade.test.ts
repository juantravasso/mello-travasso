import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deslocarCursor, diaDaSemana, diasDaGradeMensal, diasDaSemana, intervaloDaVisao, rotuloDoPeriodo } from "./grade";

describe("grade do calendário", () => {
  it("1º de outubro de 2026 é quinta-feira", () => assert.equal(diaDaSemana("2026-10-01"), 4));
  it("a grade mensal tem 42 dias, começa no domingo e cobre o mês inteiro", () => {
    const dias = diasDaGradeMensal("2026-10-15");
    assert.equal(dias.length, 42);
    assert.equal(diaDaSemana(dias[0] ?? ""), 0);
    assert.equal(dias[0], "2026-09-27");
    assert.ok(dias.includes("2026-10-01") && dias.includes("2026-10-31"));
  });
  it("a semana vai de domingo a sábado", () => {
    const dias = diasDaSemana("2026-10-22");
    assert.deepEqual([dias[0], dias[6]], ["2026-10-18", "2026-10-24"]);
  });
  it("o intervalo consultado respeita a visão", () => {
    assert.deepEqual(intervaloDaVisao("dia", "2026-10-22"), { de: "2026-10-22", ate: "2026-10-22" });
    assert.deepEqual(intervaloDaVisao("semana", "2026-10-22"), { de: "2026-10-18", ate: "2026-10-24" });
    assert.deepEqual(intervaloDaVisao("mes", "2026-10-22"), { de: "2026-09-27", ate: "2026-11-07" });
  });
  it("navega por dia, semana e mês sem pular meses curtos", () => {
    assert.equal(deslocarCursor("dia", "2026-10-31", 1), "2026-11-01");
    assert.equal(deslocarCursor("semana", "2026-10-20", -1), "2026-10-13");
    assert.equal(deslocarCursor("mes", "2026-01-31", 1), "2026-02-01");
    assert.equal(deslocarCursor("mes", "2026-01-15", -1), "2025-12-01");
  });
  it("rótulos em português", () => {
    assert.equal(rotuloDoPeriodo("mes", "2026-10-15"), "outubro de 2026");
    assert.equal(rotuloDoPeriodo("dia", "2026-10-05"), "5 de outubro de 2026");
    assert.equal(rotuloDoPeriodo("semana", "2026-10-22"), "18 a 24 de outubro de 2026");
    assert.equal(rotuloDoPeriodo("semana", "2026-10-29"), "25 a 31 de outubro de 2026");
    assert.equal(rotuloDoPeriodo("semana", "2026-10-01"), "27 de setembro a 3 de outubro de 2026");
  });
});
