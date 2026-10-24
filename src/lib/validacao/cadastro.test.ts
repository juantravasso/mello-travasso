import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { senhaSchema, TAMANHO_MINIMO_SENHA } from "./auth";
import { criarContaSchema } from "./cadastro";
import { listarErrosDoCadastro, validarCadastroNoNavegador } from "./cadastroMensagens";

const CNPJ_VALIDO = "11222333000181";
const CPF_VALIDO = "52998224725";

/** O que o cadastro de um autônomo manda: só o essencial (nome, CPF, e-mail, senha e o aceite). */
const AUTONOMO = {
  tipoPessoa: "pf" as const,
  documento: CPF_VALIDO,
  razaoSocial: "Maria da Silva",
  nomeUsuario: "Maria da Silva",
  email: "maria@exemplo.com.br",
  senha: "12345678",
  modo: "teste" as const,
  aceiteTermos: true,
};

describe("senha", () => {
  it("o mínimo é 8 caracteres", () => {
    assert.equal(TAMANHO_MINIMO_SENHA, 8);
    assert.ok(senhaSchema.safeParse("12345678").success);
    assert.ok(!senhaSchema.safeParse("1234567").success);
  });

  it("a mensagem diz o número exato", () => {
    const r = senhaSchema.safeParse("123");
    assert.ok(!r.success);
    assert.equal(r.error.issues[0]?.message, "A senha precisa ter pelo menos 8 caracteres");
  });

  it("continua com teto de 128", () => {
    assert.ok(senhaSchema.safeParse("a".repeat(128)).success);
    assert.ok(!senhaSchema.safeParse("a".repeat(129)).success);
  });
});

describe("cadastro mínimo", () => {
  it("o autônomo cadastra só com nome, CPF, e-mail, senha e o aceite (sem telefone nem endereço)", () => {
    assert.ok(criarContaSchema.safeParse(AUTONOMO).success);
  });

  it("a empresa cadastra só com CNPJ, razão social, nome do responsável, e-mail, senha e o aceite", () => {
    const empresa = { ...AUTONOMO, tipoPessoa: "pj" as const, documento: CNPJ_VALIDO, razaoSocial: "Horizonte Reformas Ltda", nomeUsuario: "Marina Albuquerque" };
    assert.ok(criarContaSchema.safeParse(empresa).success);
  });
});

describe("mensagens do cadastro: dizem exatamente o que bloqueia", () => {
  it("lista todos os problemas de uma vez, não só o primeiro", () => {
    const campos = validarCadastroNoNavegador({ ...AUTONOMO, documento: "11111111111", email: "maria@", senha: "123", aceiteTermos: false, razaoSocial: "" });
    assert.deepEqual(Object.keys(campos).sort(), ["aceiteTermos", "documento", "email", "razaoSocial", "senha"]);
  });

  it("cada mensagem diz o problema e o que fazer", () => {
    const campos = validarCadastroNoNavegador({ ...AUTONOMO, documento: "11111111111", email: "maria@", senha: "123", aceiteTermos: false });
    assert.match(campos.documento!, /CPF inválido.*11 números/);
    assert.match(campos.email!, /não parece válido.*@/);
    assert.match(campos.senha!, /pelo menos 8 caracteres/);
    assert.match(campos.aceiteTermos!, /Marque a caixa.*Termos de Uso/);
  });

  it("a mensagem do documento acompanha o tipo (CNPJ para empresa, CPF para autônomo)", () => {
    const empresa = validarCadastroNoNavegador({ ...AUTONOMO, tipoPessoa: "pj", documento: "11111111111111" });
    assert.match(empresa.documento!, /CNPJ inválido.*14 números/);
  });

  it("cadastro correto não tem erro nenhum", () => {
    assert.deepEqual(validarCadastroNoNavegador(AUTONOMO), {});
  });

  it("a lista sai na ordem da tela e com o nome do campo", () => {
    const campos = { senha: "x", documento: "y", aceiteTermos: "z", email: "w" };
    const lista = listarErrosDoCadastro(campos, "pf");
    assert.deepEqual(lista.map((e) => e.campo), ["documento", "email", "senha", "aceiteTermos"]);
    assert.equal(lista[0]?.rotulo, "CPF");
    assert.equal(listarErrosDoCadastro({ documento: "y", razaoSocial: "n" }, "pj")[1]?.rotulo, "Razão social");
    assert.equal(listarErrosDoCadastro({ razaoSocial: "n" }, "pf")[0]?.rotulo, "Nome completo");
  });
});
