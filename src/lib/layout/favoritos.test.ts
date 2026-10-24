import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { alternarFavorito, FAVORITOS_PADRAO, MAXIMO_FAVORITOS, resolverFavoritos } from "./favoritos";

const TODAS = ["/rede", "/minha-rede", "/dashboard", "/calendario", "/capturar", "/contas-a-pagar", "/contas-a-receber", "/estoque", "/planos", "/ajuda", "/configuracoes"];

describe("resolverFavoritos", () => {
  it("sem nada salvo usa o padrão, com Encontrar profissionais primeiro e só o que a pessoa pode acessar", () => {
    assert.deepEqual(resolverFavoritos(null, TODAS), [...FAVORITOS_PADRAO]);
    assert.equal(FAVORITOS_PADRAO[0], "/rede");
    assert.deepEqual(resolverFavoritos(null, ["/rede", "/planos", "/ajuda"]), ["/rede"]);
  });

  it("sem nenhuma aba do padrão, cai nas primeiras permitidas", () => {
    assert.deepEqual(resolverFavoritos(null, ["/planos", "/ajuda"]), ["/planos", "/ajuda"]);
  });

  it("respeita o que foi salvo, na ordem escolhida", () => {
    assert.deepEqual(resolverFavoritos(JSON.stringify(["/estoque", "/dashboard"]), TODAS), ["/estoque", "/dashboard"]);
  });

  it("descarta aba que a pessoa não pode mais acessar, repetida ou que não é texto", () => {
    const salvo = JSON.stringify(["/obras", "/dashboard", "/dashboard", 7, null, "/estoque"]);
    assert.deepEqual(resolverFavoritos(salvo, TODAS), ["/dashboard", "/estoque"]);
  });

  it("valor quebrado, que não é lista ou que ficou vazio volta ao padrão", () => {
    assert.deepEqual(resolverFavoritos("{quebrado", TODAS), [...FAVORITOS_PADRAO]);
    assert.deepEqual(resolverFavoritos(JSON.stringify({ a: 1 }), TODAS), [...FAVORITOS_PADRAO]);
    assert.deepEqual(resolverFavoritos("[]", TODAS), [...FAVORITOS_PADRAO]);
    assert.deepEqual(resolverFavoritos(JSON.stringify(["/obras"]), TODAS), [...FAVORITOS_PADRAO]);
  });

  it("limita ao máximo da barra", () => {
    const salvo = JSON.stringify(TODAS);
    assert.equal(resolverFavoritos(salvo, TODAS).length, MAXIMO_FAVORITOS);
  });
});

describe("alternarFavorito", () => {
  it("liga uma aba nova no fim da lista", () => {
    assert.deepEqual(alternarFavorito(["/dashboard"], "/estoque"), { lista: ["/dashboard", "/estoque"], limiteAtingido: false });
  });

  it("desliga uma aba que já era favorita", () => {
    assert.deepEqual(alternarFavorito(["/dashboard", "/estoque"], "/dashboard"), { lista: ["/estoque"], limiteAtingido: false });
  });

  it("não deixa a barra vazia ao desligar a última", () => {
    assert.deepEqual(alternarFavorito(["/dashboard"], "/dashboard"), { lista: ["/dashboard"], limiteAtingido: false });
  });

  it("avisa quando a barra já está cheia e não adiciona", () => {
    const cheia = TODAS.slice(0, MAXIMO_FAVORITOS);
    const r = alternarFavorito(cheia, "/ajuda");
    assert.equal(r.limiteAtingido, true);
    assert.deepEqual(r.lista, cheia);
  });
});
