import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fimDoPeriodoPago, somarMeses } from "./periodo";

const d = (iso: string) => new Date(iso);

describe("somarMeses", () => {
  it("mantém o dia do mês", () => {
    assert.equal(somarMeses(d("2026-10-05T12:00:00Z"), 1).toISOString(), "2026-11-05T12:00:00.000Z");
    assert.equal(somarMeses(d("2026-10-05T12:00:00Z"), 3).toISOString(), "2027-01-05T12:00:00.000Z");
  });

  it("em mês mais curto cai no último dia", () => {
    assert.equal(somarMeses(d("2026-01-31T10:00:00Z"), 1).toISOString(), "2026-02-28T10:00:00.000Z");
    assert.equal(somarMeses(d("2028-01-31T10:00:00Z"), 1).toISOString(), "2028-02-29T10:00:00.000Z");
    assert.equal(somarMeses(d("2026-03-31T10:00:00Z"), 1).toISOString(), "2026-04-30T10:00:00.000Z");
  });

  it("atravessa a virada do ano", () => {
    assert.equal(somarMeses(d("2026-12-15T00:00:00Z"), 2).toISOString(), "2027-02-15T00:00:00.000Z");
  });
});

describe("fimDoPeriodoPago", () => {
  it("se a próxima cobrança ainda não chegou, o período pago termina nela", () => {
    const fim = fimDoPeriodoPago("2026-11-05T12:00:00Z", d("2026-10-20T09:00:00Z"));
    assert.equal(fim.toISOString(), "2026-11-05T12:00:00.000Z");
  });

  it("se o valor guardado ficou para trás, avança mês a mês até a próxima cobrança futura", () => {
    // guardado: 05/11; hoje 20/02 → a assinatura renovou em 05/11, 05/12, 05/01 e 05/02; a próxima é 05/03.
    const fim = fimDoPeriodoPago("2026-11-05T12:00:00Z", d("2027-02-20T09:00:00Z"));
    assert.equal(fim.toISOString(), "2027-03-05T12:00:00.000Z");
  });

  it("cancelar no mesmo dia da cobrança vale até o mês seguinte, nunca para trás", () => {
    const fim = fimDoPeriodoPago("2026-11-05T12:00:00Z", d("2026-11-05T12:00:00Z"));
    assert.equal(fim.toISOString(), "2026-12-05T12:00:00.000Z");
  });

  it("nunca devolve data no passado", () => {
    const agora = d("2028-06-10T00:00:00Z");
    assert.ok(fimDoPeriodoPago("2026-01-31T10:00:00Z", agora).getTime() > agora.getTime());
  });

  it("recusa data inválida", () => {
    assert.throws(() => fimDoPeriodoPago("não é data", d("2026-10-20T00:00:00Z")));
  });
});
