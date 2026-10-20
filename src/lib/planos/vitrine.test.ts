import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FUNCIONALIDADES, PROBLEMAS } from "./vitrine";

describe("vitrine comercial", () => {
  it("cada problema tem dor, solução e recurso, sem repetir id", () => {
    const ids = new Set<string>();
    for (const p of PROBLEMAS) {
      assert.ok(p.problema.length > 10 && p.solucao.length > 10 && p.recurso.length > 2, p.id);
      assert.ok(!ids.has(p.id), `id repetido: ${p.id}`);
      ids.add(p.id);
    }
    assert.ok(PROBLEMAS.length >= 5);
  });

  it("o texto não promete resultado garantido nem usa absolutos", () => {
    const todos = [...PROBLEMAS.flatMap((p) => [p.problema, p.solucao]), ...FUNCIONALIDADES.flatMap((g) => g.itens)].join(" ").toLowerCase();
    for (const proibido of ["garanti", "100%", "nunca mais", "sem erro", "ilimitad", "milagre", "economize"]) {
      assert.ok(!todos.includes(proibido), `texto contém "${proibido}"`);
    }
  });

  it("os grupos de funcionalidades não têm item repetido", () => {
    const itens = FUNCIONALIDADES.flatMap((g) => g.itens);
    assert.equal(new Set(itens).size, itens.length);
  });
});
