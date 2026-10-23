import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BENEFICIO_INSTALACAO, detectarPlataforma, ehIosForaDoSafari, GUIAS } from "./instalacao";

const UA_IPHONE_SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const UA_IPHONE_CHROME = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1";
const UA_IPHONE_INSTAGRAM = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0";
const UA_ANDROID_CHROME = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36";
const UA_MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";

describe("guia de instalação: conteúdo", () => {
  it("tem passos para as duas plataformas, citando a tela de início", () => {
    for (const g of Object.values(GUIAS)) {
      assert.ok(g.passos.length >= 3, g.plataforma);
      assert.ok(g.passos.every((p) => p.trim().length > 10), g.plataforma);
      assert.match(g.passos.join(" "), /tela (de )?in[ií]cio|tela inicial/i, g.plataforma);
      assert.ok(g.observacao.length > 10);
    }
  });

  it("o iPhone ensina o caminho pelo Compartilhar e avisa do Safari", () => {
    const texto = GUIAS.ios.passos.join(" ");
    assert.match(texto, /Compartilhar/);
    assert.match(texto, /Adicionar à Tela de Início/);
    assert.match(GUIAS.ios.observacao, /Safari/);
  });

  it("não promete o que o sistema não faz (offline, notificações) nem garante resultado", () => {
    const todo = [BENEFICIO_INSTALACAO, ...Object.values(GUIAS).flatMap((g) => [...g.passos, g.observacao])].join(" ").toLowerCase();
    for (const proibido of ["offline", "sem internet", "notifica", "push", "garanti", "100%", "ilimitad"]) {
      assert.ok(!todo.includes(proibido), `texto contém "${proibido}"`);
    }
  });
});

describe("detecção de plataforma", () => {
  it("reconhece iPhone, Android e computador", () => {
    assert.equal(detectarPlataforma({ userAgent: UA_IPHONE_SAFARI }), "ios");
    assert.equal(detectarPlataforma({ userAgent: UA_ANDROID_CHROME }), "android");
    assert.equal(detectarPlataforma({ userAgent: UA_MAC, platform: "MacIntel", maxTouchPoints: 0 }), "outro");
  });

  it("iPad novo se apresenta como Mac, mas tem tela de toque", () => {
    assert.equal(detectarPlataforma({ userAgent: UA_MAC, platform: "MacIntel", maxTouchPoints: 5 }), "ios");
  });

  it("detecta iPhone fora do Safari (navegador alternativo ou aplicativo)", () => {
    assert.equal(ehIosForaDoSafari(UA_IPHONE_SAFARI), false);
    assert.equal(ehIosForaDoSafari(UA_IPHONE_CHROME), true);
    assert.equal(ehIosForaDoSafari(UA_IPHONE_INSTAGRAM), true);
    assert.equal(ehIosForaDoSafari(UA_ANDROID_CHROME), false);
  });
});
