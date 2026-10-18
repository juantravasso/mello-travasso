import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { gerarCodigoConvite, linkDoConvite, normalizarCodigoConvite, TAMANHO_CODIGO_CONVITE } from "./convite";

describe("código do convite", () => {
  it("gera 8 caracteres do alfabeto sem símbolos ambíguos", () => {
    for (let i = 0; i < 500; i++) {
      const codigo = gerarCodigoConvite();
      assert.equal(codigo.length, TAMANHO_CODIGO_CONVITE);
      assert.match(codigo, /^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{8}$/);
    }
  });

  it("não repete em uma amostra grande", () => {
    const vistos = new Set<string>();
    for (let i = 0; i < 5000; i++) vistos.add(gerarCodigoConvite());
    assert.equal(vistos.size, 5000);
  });

  it("normaliza maiúsculas e espaços", () => {
    assert.equal(normalizarCodigoConvite("  k7m2qx9p "), "K7M2QX9P");
  });

  it("ignora o que não tem o formato: tamanho errado, símbolo ambíguo, tipo errado", () => {
    assert.equal(normalizarCodigoConvite("K7M2QX9"), null);
    assert.equal(normalizarCodigoConvite("K7M2QX9PP"), null);
    assert.equal(normalizarCodigoConvite("K7M2QX9O"), null); // O
    assert.equal(normalizarCodigoConvite("K7M2QX91"), null); // 1
    assert.equal(normalizarCodigoConvite("K7M2QX9!"), null);
    assert.equal(normalizarCodigoConvite(undefined), null);
    assert.equal(normalizarCodigoConvite(["K7M2QX9P"]), null);
  });

  it("monta o link sem barra duplicada", () => {
    assert.equal(linkDoConvite("https://www.exemplo.com.br/", "K7M2QX9P"), "https://www.exemplo.com.br/criar-conta?convite=K7M2QX9P");
    assert.equal(linkDoConvite("https://www.exemplo.com.br", "K7M2QX9P"), "https://www.exemplo.com.br/criar-conta?convite=K7M2QX9P");
  });
});
