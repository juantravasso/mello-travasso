import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cadastroCompleto, configuracaoPadrao, dataDaBaixaAutomatica, deveBaixarSozinha, proximoVencimento } from "./formaPagamento";

describe("configuracaoPadrao", () => {
  it("o que se paga na hora baixa sozinho; o que se paga depois não", () => {
    for (const k of ["dinheiro", "pix", "cartao_debito", "transferencia"]) assert.equal(configuracaoPadrao(k).baixaAutomatica, true, k);
    for (const k of ["cartao_credito", "boleto", "cheque", "id-de-forma-personalizada"]) assert.equal(configuracaoPadrao(k).baixaAutomatica, false, k);
  });
});

describe("proximoVencimento", () => {
  it("o dia ainda não passou: vence neste mês", () => {
    assert.equal(proximoVencimento("2026-10-03", 10), "2026-10-10");
  });
  it("o dia de hoje conta (inclusive)", () => {
    assert.equal(proximoVencimento("2026-10-10", 10), "2026-10-10");
  });
  it("o dia já passou: vence no mês seguinte", () => {
    assert.equal(proximoVencimento("2026-10-15", 10), "2026-11-10");
  });
  it("vira o ano", () => {
    assert.equal(proximoVencimento("2026-12-20", 5), "2027-01-05");
  });
  it("dia 31 em mês curto cai no último dia", () => {
    assert.equal(proximoVencimento("2026-02-10", 31), "2026-02-28");
    assert.equal(proximoVencimento("2028-02-10", 31), "2028-02-29");
    assert.equal(proximoVencimento("2026-04-10", 31), "2026-04-30");
  });
  it("dia 31 depois do fim de um mês curto pula para o mês seguinte", () => {
    assert.equal(proximoVencimento("2026-04-30", 31), "2026-04-30");
    assert.equal(proximoVencimento("2026-01-31", 30), "2026-02-28");
  });
});

describe("deveBaixarSozinha", () => {
  const pix = configuracaoPadrao("pix");
  const boleto = configuracaoPadrao("boleto");
  it("só com cadastro completo", () => {
    assert.equal(deveBaixarSozinha({ categoria: "aluguel", formaPagamento: "pix", parcelada: false }, pix), true);
    assert.equal(deveBaixarSozinha({ categoria: "", formaPagamento: "pix", parcelada: false }, pix), false);
    assert.equal(deveBaixarSozinha({ categoria: "aluguel", formaPagamento: undefined, parcelada: false }, pix), false);
  });
  it("forma sem baixa automática não baixa", () => {
    assert.equal(deveBaixarSozinha({ categoria: "aluguel", formaPagamento: "boleto", parcelada: false }, boleto), false);
  });
  it("conta parcelada nunca baixa sozinha", () => {
    assert.equal(deveBaixarSozinha({ categoria: "aluguel", formaPagamento: "pix", parcelada: true }, pix), false);
  });
  it("cadastroCompleto ignora espaços", () => {
    assert.equal(cadastroCompleto({ categoria: "  ", formaPagamento: "pix" }), false);
  });
});

describe("dataDaBaixaAutomatica", () => {
  it("nunca no futuro", () => {
    assert.equal(dataDaBaixaAutomatica("2026-10-20", "2026-10-25"), "2026-10-20");
    assert.equal(dataDaBaixaAutomatica("2026-11-20", "2026-10-25"), "2026-10-25");
  });
});
