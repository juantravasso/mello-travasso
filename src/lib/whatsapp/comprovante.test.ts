import assert from "node:assert/strict";
import { test } from "node:test";
import { descricaoDaConta, ehCancelar, lerEscolha, OPCOES_CATEGORIA, textoContaLancada, textoPerguntaCategoria, textoPerguntaProjeto } from "./comprovante";

test("lerEscolha aceita só um número dentro das opções", () => {
  assert.equal(lerEscolha("2", 5), 2);
  assert.equal(lerEscolha(" 3. ", 5), 3);
  assert.equal(lerEscolha("opção 1", 5), 1);
  assert.equal(lerEscolha("4)", 5), 4);
  assert.equal(lerEscolha("0", 5), null);
  assert.equal(lerEscolha("6", 5), null);
  assert.equal(lerEscolha("paguei o pedreiro", 5), null);
  assert.equal(lerEscolha("2 e 3", 5), null);
  assert.equal(lerEscolha("", 5), null);
});

test("ehCancelar reconhece só o pedido de cancelar", () => {
  assert.equal(ehCancelar("CANCELAR"), true);
  assert.equal(ehCancelar(" cancela! "), true);
  assert.equal(ehCancelar("quero cancelar minha assinatura"), false);
});

test("a pergunta da categoria mostra valor, favorecido, data e as opções numeradas", () => {
  const t = textoPerguntaCategoria({ valor: 350, data: "2026-11-20", favorecido: "José da Silva" });
  assert.match(t, /R\$\s?350,00 para José da Silva, de 20\/11\/2026/);
  for (const [i, o] of OPCOES_CATEGORIA.entries()) assert.ok(t.includes(`${i + 1}. ${o.rotulo}`));
  assert.match(t, /Pagamento de funcionário/);
  assert.match(t, /CANCELAR/);
});

test("a pergunta do projeto numera os projetos", () => {
  assert.match(textoPerguntaProjeto([{ nome: "Casa Barra" }, { nome: "Reforma Tijuca" }]), /1\. Casa Barra\n2\. Reforma Tijuca/);
});

test("o resultado diz se a conta entrou paga ou em aberto e traz o link", () => {
  const base = { valor: 350, data: "2026-11-20", favorecido: "José", rotuloCategoria: "Pagamento de funcionário", projeto: "Casa Barra", link: "https://x/contas-a-pagar/1" };
  assert.match(textoContaLancada({ ...base, baixada: true }), /Pagamento de funcionário de R\$\s?350,00 para José, no projeto Casa Barra/);
  assert.match(textoContaLancada({ ...base, baixada: true }), /já entrou como paga/);
  assert.match(textoContaLancada({ ...base, baixada: false }), /em aberto/);
  assert.equal(descricaoDaConta({ valor: 1, data: "2026-11-20", favorecido: "José", rotuloCategoria: "Frete ou transporte" }), "Frete ou transporte · José");
  assert.equal(descricaoDaConta({ valor: 1, data: "2026-11-20", favorecido: "José", descricao: "Pix ref. diária" }), "Pix ref. diária");
});
