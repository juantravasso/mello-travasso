import assert from "node:assert/strict";
import test from "node:test";
import { normalizarTextoLivre, tempoRelativo } from "./feed";
import { codificarCursor, decodificarCursor } from "./feedCursor";

test("normalizarTextoLivre padroniza quebras e limita linhas em branco", () => {
  assert.equal(normalizarTextoLivre("  oi\r\n\r\n\r\n\r\ntudo bem  \n"), "oi\n\ntudo bem");
});

test("normalizarTextoLivre remove caracteres de controle", () => {
  assert.equal(normalizarTextoLivre("a\u0000b\u0007c"), "abc");
});

test("cursor vai e volta, e lixo vira null", () => {
  const c = { criadoEm: "2026-11-09T10:00:00.000Z", id: "abc" };
  assert.deepEqual(decodificarCursor(codificarCursor(c)), c);
  assert.equal(decodificarCursor("lixo"), null);
  assert.equal(decodificarCursor(Buffer.from(JSON.stringify({ criadoEm: "x", id: "1" })).toString("base64url")), null);
});

test("tempoRelativo", () => {
  const agora = new Date("2026-11-09T12:00:00.000Z");
  assert.equal(tempoRelativo("2026-11-09T11:59:30.000Z", agora), "agora");
  assert.equal(tempoRelativo("2026-11-09T11:55:00.000Z", agora), "há 5 min");
  assert.equal(tempoRelativo("2026-11-09T09:00:00.000Z", agora), "há 3 h");
  assert.equal(tempoRelativo("2026-11-07T12:00:00.000Z", agora), "há 2 d");
});
