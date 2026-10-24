import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cepCompleto, digitosDoCep, formatarCep } from "./cep";

describe("cep", () => {
  it("formata enquanto digita", () => {
    assert.equal(formatarCep(""), "");
    assert.equal(formatarCep("2004"), "2004");
    assert.equal(formatarCep("20040"), "20040");
    assert.equal(formatarCep("200400"), "20040-0");
    assert.equal(formatarCep("20040020"), "20040-020");
  });

  it("ignora o que não é número e corta no oitavo dígito", () => {
    assert.equal(formatarCep("20.040-020"), "20040-020");
    assert.equal(formatarCep("20040-0201234"), "20040-020");
    assert.equal(formatarCep("abc"), "");
    assert.equal(digitosDoCep("20040-020"), "20040020");
  });

  it("só é completo com 8 dígitos", () => {
    assert.equal(cepCompleto("20040-02"), false);
    assert.equal(cepCompleto("20040-020"), true);
    assert.equal(cepCompleto("20040020"), true);
  });
});
