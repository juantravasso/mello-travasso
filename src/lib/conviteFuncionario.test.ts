import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  expiracaoDoConvite,
  gerarTokenConviteFuncionario,
  hashDoToken,
  linkDoConviteFuncionario,
  tokenConviteFuncionarioValido,
} from "./conviteFuncionario";

describe("convite de funcionário", () => {
  it("gera tokens únicos e no formato esperado", () => {
    const a = gerarTokenConviteFuncionario();
    const b = gerarTokenConviteFuncionario();
    assert.notEqual(a, b);
    assert.ok(tokenConviteFuncionarioValido(a));
    assert.equal(a.length, 43);
  });

  it("recusa token fora do formato", () => {
    for (const ruim of ["", "abc", "x".repeat(42), "x".repeat(44), `${"a".repeat(42)}!`, null, undefined, 123]) {
      assert.equal(tokenConviteFuncionarioValido(ruim), false);
    }
  });

  it("hash é estável e não revela o token", () => {
    const t = gerarTokenConviteFuncionario();
    assert.equal(hashDoToken(t), hashDoToken(t));
    assert.notEqual(hashDoToken(t), t);
    assert.equal(hashDoToken(t).length, 64);
  });

  it("monta o link sem barra dupla e expira em 7 dias", () => {
    assert.equal(linkDoConviteFuncionario("https://x.com/", "T"), "https://x.com/cadastro-funcionario/T");
    const base = new Date("2026-11-10T12:00:00.000Z");
    assert.equal(expiracaoDoConvite(base), "2026-11-17T12:00:00.000Z");
  });
});
