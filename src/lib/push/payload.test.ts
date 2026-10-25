import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hrefInterno, montarPayloadPush } from "./payload";

describe("hrefInterno", () => {
  it("aceita caminho interno com query", () => {
    assert.equal(hrefInterno("/calendario?evento=abc"), "/calendario?evento=abc");
  });

  it("recusa endereço de fora e variações", () => {
    for (const ruim of ["https://x.com", "//x.com", "javascript:alert(1)", "calendario", "/\\x.com", "/a b"]) {
      assert.equal(hrefInterno(ruim), "/calendario", ruim);
    }
  });
});

describe("montarPayloadPush", () => {
  it("corta títulos e textos longos e junta espaços", () => {
    const p = montarPayloadPush({ titulo: "T".repeat(200), texto: `${"a  b ".repeat(100)}`, href: "/calendario" });
    assert.ok(p.titulo.length <= 80 && p.titulo.endsWith("…"));
    assert.ok(p.texto.length <= 180);
    assert.ok(!p.texto.includes("  "));
  });

  it("título vazio vira 'Lembrete'", () => {
    assert.equal(montarPayloadPush({ titulo: null, texto: "x", href: "/calendario" }).titulo, "Lembrete");
  });
});
