import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { podeAlterar, podeVer } from "./permissoes";

const compromisso = { empresaId: "empresa-a", criadoPorId: "ana", participantesIds: ["bruno"] };
const ana = { usuarioId: "ana", empresaId: "empresa-a" };
const bruno = { usuarioId: "bruno", empresaId: "empresa-a" };
const carla = { usuarioId: "carla", empresaId: "empresa-a" };
const intruso = { usuarioId: "dino", empresaId: "empresa-b" };

describe("quem vê o compromisso", () => {
  it("o criador vê", () => assert.equal(podeVer(compromisso, ana), true));
  it("o participante vê", () => assert.equal(podeVer(compromisso, bruno), true));
  it("colega da mesma empresa que não foi incluído não vê (o calendário pessoal não é aberto)", () => assert.equal(podeVer(compromisso, carla), false));
  it("outra empresa nunca vê", () => assert.equal(podeVer(compromisso, intruso), false));
  it("nem quando o identificador dele aparece como participante: a empresa é conferida primeiro", () => {
    const manipulado = { ...compromisso, participantesIds: ["bruno", "dino"] };
    assert.equal(podeVer(manipulado, intruso), false);
  });
});

describe("quem altera o compromisso", () => {
  it("só o criador edita, exclui ou compartilha", () => {
    assert.equal(podeAlterar(compromisso, ana), true);
    assert.equal(podeAlterar(compromisso, bruno), false);
    assert.equal(podeAlterar(compromisso, carla), false);
  });
  it("outra empresa com o mesmo identificador de usuário não altera", () => {
    assert.equal(podeAlterar(compromisso, { usuarioId: "ana", empresaId: "empresa-b" }), false);
  });
});
