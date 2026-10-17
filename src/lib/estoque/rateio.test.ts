import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { contaTocaDestino, custoDaTransferencia, destinoPrincipal, escalarRateios, ratearConta, valorDoDestino } from "./rateio";

const soma = (r: { valor: number }[]) => Math.round(r.reduce((s, x) => s + x.valor, 0) * 100) / 100;

describe("rateio da nota entre destinos", () => {
  it("um destino só recebe o valor inteiro da nota", () => {
    assert.deepEqual(ratearConta([{ obraId: "A", valorTotal: 50 }, { obraId: "A", valorTotal: 70 }], 120), [{ obraId: "A", valor: 120 }]);
  });
  it("divide proporcional ao valor dos itens", () => {
    const r = ratearConta([{ obraId: "A", valorTotal: 300 }, { obraId: "B", valorTotal: 100 }], 400);
    assert.deepEqual(r, [{ obraId: "A", valor: 300 }, { obraId: "B", valor: 100 }]);
  });
  it("o que a nota tem além dos itens (frete) é rateado na mesma proporção", () => {
    const r = ratearConta([{ obraId: "A", valorTotal: 300 }, { obraId: "B", valorTotal: 100 }], 440);
    assert.deepEqual(r, [{ obraId: "A", valor: 330 }, { obraId: "B", valor: 110 }]);
  });
  it("os centavos sempre fecham no valor da nota (100,00 em três partes iguais)", () => {
    const r = ratearConta([{ obraId: "A", valorTotal: 1 }, { obraId: "B", valorTotal: 1 }, { obraId: "C", valorTotal: 1 }], 100);
    assert.equal(soma(r), 100);
    assert.deepEqual(r.map((x) => x.valor).sort(), [33.33, 33.33, 33.34]);
  });
  it("soma de itens de mesmo destino é agrupada, na ordem da primeira aparição", () => {
    const r = ratearConta([{ obraId: "B", valorTotal: 10 }, { obraId: "A", valorTotal: 10 }, { obraId: "B", valorTotal: 10 }], 30);
    assert.deepEqual(r, [{ obraId: "B", valor: 20 }, { obraId: "A", valor: 10 }]);
  });
  it("itens de valor zero dividem igualmente em vez de dar divisão por zero", () => {
    const r = ratearConta([{ obraId: "A", valorTotal: 0 }, { obraId: "B", valorTotal: 0 }], 10);
    assert.equal(soma(r), 10);
    assert.deepEqual(r.map((x) => x.valor), [5, 5]);
  });
  it("sem itens, nada a ratear", () => assert.deepEqual(ratearConta([], 100), []));
  it("valor com muitas casas fecha em centavos", () => {
    const r = ratearConta([{ obraId: "A", valorTotal: 19.99 }, { obraId: "B", valorTotal: 5.01 }], 25);
    assert.equal(soma(r), 25);
  });
});

describe("rateio de uma parcela", () => {
  it("mantém a proporção e fecha os centavos de cada parcela", () => {
    const base = ratearConta([{ obraId: "A", valorTotal: 70 }, { obraId: "B", valorTotal: 30 }], 100);
    const parcela = escalarRateios(base, 33.33);
    assert.equal(soma(parcela), 33.33);
    assert.deepEqual(parcela.map((p) => p.obraId), ["A", "B"]);
  });
  it("as parcelas somadas dão o rateio da nota", () => {
    const base = ratearConta([{ obraId: "A", valorTotal: 70 }, { obraId: "B", valorTotal: 30 }], 100);
    const parcelas = [33.33, 33.33, 33.34].map((v) => escalarRateios(base, v));
    assert.equal(soma(parcelas.flat()), 100);
  });
});

describe("destino principal e valor por destino", () => {
  const rateios = [{ obraId: "A", valor: 30 }, { obraId: "B", valor: 70 }];
  it("o principal é o de maior valor", () => assert.equal(destinoPrincipal(rateios), "B"));
  it("sem rateio, tudo vai para o projeto da conta", () => {
    const conta = { obraId: "A", valor: 100 };
    assert.equal(valorDoDestino(conta, "A"), 100);
    assert.equal(valorDoDestino(conta, "B"), 0);
  });
  it("com rateio, cada destino fica com a sua parte (e o projeto da conta não leva tudo)", () => {
    const conta = { obraId: "B", valor: 100, rateios };
    assert.equal(valorDoDestino(conta, "A"), 30);
    assert.equal(valorDoDestino(conta, "B"), 70);
    assert.equal(valorDoDestino(conta, "C"), 0);
  });
  it("a conta toca os destinos do rateio e o projeto dela quando não há rateio", () => {
    assert.equal(contaTocaDestino({ obraId: "B", valor: 100, rateios }, "A"), true);
    assert.equal(contaTocaDestino({ obraId: "B", valor: 100, rateios }, "C"), false);
    assert.equal(contaTocaDestino({ obraId: "A", valor: 100 }, "A"), true);
    assert.equal(contaTocaDestino({ obraId: "A", valor: 100 }, "B"), false);
  });
});

describe("custo da transferência", () => {
  it("quantidade vezes o valor da última compra, em centavos", () => {
    assert.equal(custoDaTransferencia(10, 35.9), 359);
    assert.equal(custoDaTransferencia(3, 0.1), 0.3);
    assert.equal(custoDaTransferencia(2.5, 19.99), 49.98);
  });
  it("sem valor de compra o custo é zero", () => assert.equal(custoDaTransferencia(10, 0), 0));
});
