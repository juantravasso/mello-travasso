import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { assinaturaWahaConfere, extrairCodigo, gerarCodigo, hashCodigo, lerMensagemWaha, linkDeVinculo, numeroDoChat, numeroEloValido, TAMANHO_CODIGO } from "./vinculo";

test("o código gerado tem o tamanho certo e só usa o alfabeto sem ambiguidade", () => {
  for (let i = 0; i < 200; i++) {
    const c = gerarCodigo();
    assert.equal(c.length, TAMANHO_CODIGO);
    assert.match(c, /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]+$/);
  }
});

test("o hash não depende de maiúsculas e não revela o código", () => {
  assert.equal(hashCodigo("abcd2345"), hashCodigo("ABCD2345"));
  assert.notEqual(hashCodigo("ABCD2345"), "ABCD2345");
});

test("extrairCodigo aceita só a mensagem de vínculo", () => {
  assert.equal(extrairCodigo("VINCULAR ABCD2345"), "ABCD2345");
  assert.equal(extrairCodigo("  vincular: abcd2345 "), "ABCD2345");
  assert.equal(extrairCodigo("Vincular abcd2345."), "ABCD2345");
  assert.equal(extrairCodigo("oi, tudo bem?"), null);
  assert.equal(extrairCodigo("VINCULAR"), null);
  assert.equal(extrairCodigo("VINCULAR ABCD234"), null, "curto demais");
  assert.equal(extrairCodigo("VINCULAR ABCD23456"), null, "longo demais");
  assert.equal(extrairCodigo("VINCULAR ABCD0O1I"), null, "letras fora do alfabeto");
  assert.equal(extrairCodigo("preciso de ajuda, VINCULAR ABCD2345"), null, "texto extra não vale");
  assert.equal(extrairCodigo(null), null);
  assert.equal(extrairCodigo("VINCULAR " + "A".repeat(200)), null);
});

test("numeroDoChat só reconhece telefone de verdade, não @lid", () => {
  assert.equal(numeroDoChat("5521985097600@c.us"), "5521985097600");
  assert.equal(numeroDoChat("5521985097600@s.whatsapp.net"), "5521985097600");
  assert.equal(numeroDoChat("123456789012345@lid"), null);
  assert.equal(numeroDoChat("grupo@g.us"), null);
});

test("numeroEloValido exige DDI e DDD", () => {
  assert.equal(numeroEloValido("+55 (21) 98509-7600"), "5521985097600");
  assert.equal(numeroEloValido("21985097600"), null);
  assert.equal(numeroEloValido(undefined), null);
});

test("linkDeVinculo leva a mensagem pronta", () => {
  assert.equal(linkDeVinculo("5521985097600", "ABCD2345"), "https://wa.me/5521985097600?text=VINCULAR%20ABCD2345");
});

test("assinatura do webhook: confere o corpo bruto e recusa o resto", () => {
  const corpo = '{"event":"message","session":"default"}';
  const hmac = createHmac("sha512", "segredo").update(corpo).digest("hex");
  assert.equal(assinaturaWahaConfere(corpo, hmac, "segredo"), true);
  assert.equal(assinaturaWahaConfere(corpo + " ", hmac, "segredo"), false, "corpo alterado");
  assert.equal(assinaturaWahaConfere(corpo, hmac, "outro"), false, "chave errada");
  assert.equal(assinaturaWahaConfere(corpo, null, "segredo"), false, "sem cabeçalho");
  assert.equal(assinaturaWahaConfere(corpo, "não-é-hex", "segredo"), false);
  assert.equal(assinaturaWahaConfere(corpo, hmac, ""), false, "sem chave");
});

test("lerMensagemWaha: só mensagem de outra pessoa, individual, da sessão certa", () => {
  const base = { event: "message", session: "default", payload: { from: "5521999990000@c.us", fromMe: false, body: "VINCULAR ABCD2345" } };
  assert.deepEqual(lerMensagemWaha(base, "default"), { chatId: "5521999990000@c.us", texto: "VINCULAR ABCD2345", numero: "5521999990000", mensagemId: null, midia: null });
  assert.equal(lerMensagemWaha({ ...base, session: "outra" }, "default"), null);
  assert.equal(lerMensagemWaha({ ...base, event: "message.ack" }, "default"), null);
  assert.equal(lerMensagemWaha({ ...base, payload: { ...base.payload, fromMe: true } }, "default"), null, "mensagem do próprio Elo");
  assert.equal(lerMensagemWaha({ ...base, payload: { ...base.payload, from: "12345-678@g.us" } }, "default"), null, "grupo");
  assert.equal(lerMensagemWaha({ ...base, payload: { ...base.payload, from: "status@broadcast" } }, "default"), null);
  assert.equal(lerMensagemWaha(null, "default"), null);
  assert.equal(lerMensagemWaha("texto", "default"), null);
});

test("lerMensagemWaha: @lid vem sem telefone, a não ser que o WAHA o informe ao lado", () => {
  const lid = { event: "message", session: "default", payload: { from: "99887766@lid", body: "oi" } };
  assert.deepEqual(lerMensagemWaha(lid, "default"), { chatId: "99887766@lid", texto: "oi", numero: null, mensagemId: null, midia: null });
  const comTelefone = { ...lid, payload: { ...lid.payload, _data: { key: { remoteJidAlt: "5521988887777@s.whatsapp.net" } } } };
  assert.equal(lerMensagemWaha(comTelefone, "default")?.numero, "5521988887777");
});

test("lerMensagemWaha reconhece foto e outros arquivos", () => {
  const foto = { event: "message", session: "default", payload: { id: "m1", from: "5521999990000@c.us", body: "", hasMedia: true, media: { url: "https://waha.x/api/files/a.jpg", mimetype: "image/jpeg" } } };
  assert.deepEqual(lerMensagemWaha(foto, "default")?.midia, { tipo: "imagem", url: "https://waha.x/api/files/a.jpg", mimetype: "image/jpeg" });
  assert.equal(lerMensagemWaha(foto, "default")?.mensagemId, "m1");
  const pdf = { ...foto, payload: { ...foto.payload, media: { url: "https://waha.x/f.pdf", mimetype: "application/pdf" } } };
  assert.equal(lerMensagemWaha(pdf, "default")?.midia?.tipo, "outra");
});
