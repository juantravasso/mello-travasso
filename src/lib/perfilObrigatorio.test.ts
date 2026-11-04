import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { exigePublicarPerfil, rotaLiberadaSemPerfil } from "./perfilObrigatorio";

const base = { papel: "dono" as const, admin: false, statusPerfil: "rascunho" as string | null, jaPublicou: false, temRede: true };

describe("exigePublicarPerfil", () => {
  it("exige do dono que ainda não publicou (perfil em rascunho ou ainda não aberto)", () => {
    assert.equal(exigePublicarPerfil(base), true);
    assert.equal(exigePublicarPerfil({ ...base, statusPerfil: null }), true);
  });
  it("não exige depois da primeira publicação, nem se ele despublicar", () => {
    assert.equal(exigePublicarPerfil({ ...base, statusPerfil: "publicado", jaPublicou: true }), false);
    assert.equal(exigePublicarPerfil({ ...base, statusPerfil: "rascunho", jaPublicou: true }), false);
  });
  it("não prende perfil suspenso pela administração", () => {
    assert.equal(exigePublicarPerfil({ ...base, statusPerfil: "suspenso" }), false);
  });
  it("não exige de funcionário nem de administrador da plataforma", () => {
    assert.equal(exigePublicarPerfil({ ...base, papel: "membro" }), false);
    assert.equal(exigePublicarPerfil({ ...base, admin: true }), false);
  });
  it("não exige quando o plano não inclui o Elo Profissionais", () => {
    assert.equal(exigePublicarPerfil({ ...base, temRede: false }), false);
  });
});

describe("rotaLiberadaSemPerfil", () => {
  it("libera o Elo Profissionais, Configurações e Ajuda (e o que está dentro)", () => {
    for (const r of ["/minha-rede", "/minha-rede/perfil", "/minha-rede/portfolio", "/configuracoes", "/ajuda", "/ajuda/qualquer"]) {
      assert.equal(rotaLiberadaSemPerfil(r), true, r);
    }
  });
  it("bloqueia o resto, inclusive prefixos parecidos", () => {
    for (const r of ["/dashboard", "/contas-a-pagar", "/minha-rede-falsa", "/configuracoes-x", "/rede"]) {
      assert.equal(rotaLiberadaSemPerfil(r), false, r);
    }
  });
});
