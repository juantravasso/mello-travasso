import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { chaveDoItem, chaveFornecedor, formatarNumeroCompra, sugerirProduto, totaisDaCompra, totalDoItem } from "./compras";

describe("compras", () => {
  it("total do item desconta e nunca fica negativo", () => {
    assert.equal(totalDoItem(15, 88.76, 0), 1331.4);
    assert.equal(totalDoItem(2, 10, 5), 15);
    assert.equal(totalDoItem(1, 10, 50), 0);
  });

  it("soma produtos, desconto e despesas", () => {
    const t = totaisDaCompra(
      [
        { valorTotal: 100, desconto: 5 },
        { valorTotal: 50.5, desconto: 0 },
      ],
      10,
      0,
      2.25,
    );
    assert.deepEqual(t, { valorProdutos: 150.5, descontoTotal: 5, valorTotal: 162.75 });
  });

  it("chaves: código tem prioridade e descrição ignora acento e caixa", () => {
    assert.equal(chaveDoItem("861-0275", "x"), "c:861-0275");
    assert.equal(chaveDoItem(undefined, "  Alicate  Pressão "), chaveDoItem(undefined, "alicate pressao"));
    assert.equal(chaveFornecedor("abc", "Fame"), "abc");
    assert.equal(chaveFornecedor(undefined, "FAME"), "fame");
    assert.equal(chaveFornecedor(undefined, undefined), "");
  });

  it("numeração com zeros", () => {
    assert.equal(formatarNumeroCompra(14103), "014103");
  });

  it("sugere por vínculo, depois nome igual, depois parecido, senão nada", () => {
    const produtos = [
      { id: "p1", nome: "ALICATE PRESSAO 10 GUEPAR" },
      { id: "p2", nome: "Disco corte turbo seco porcelanato 115mm" },
    ];
    const vinculos = new Map([[chaveDoItem("861-0270", ""), "p1"]]);
    assert.deepEqual(sugerirProduto({ descricao: "qualquer", codigoFornecedor: "861-0270" }, vinculos, produtos), { produtoId: "p1", motivo: "vinculo" });
    assert.deepEqual(sugerirProduto({ descricao: "alicate pressão 10 guepar" }, new Map(), produtos), { produtoId: "p1", motivo: "nome" });
    assert.equal(sugerirProduto({ descricao: "Disco de corte turbo porcelanato 115mm flex" }, new Map(), produtos)?.motivo, "parecido");
    assert.equal(sugerirProduto({ descricao: "cimento cp2" }, new Map(), produtos), null);
  });
});
