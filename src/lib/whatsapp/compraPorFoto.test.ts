import assert from "node:assert/strict";
import { test } from "node:test";
import { FORNECEDOR_NAO_LIDO, montarRascunhoDaFoto, textoDoRascunho } from "./compraPorFoto";

const opcoes = { destinoId: "deposito-1", hoje: "2026-11-25", fotoDataUrl: "data:image/jpeg;base64,AAAA" };

test("monta o rascunho com os itens lidos, no destino dado, sem efetivar nada", () => {
  const r = montarRascunhoDaFoto(
    {
      tipoDocumento: "nota_fiscal",
      favorecido: " Casa do Construtor ",
      data: "2026-11-20",
      itens: [
        { descricao: "Cimento CP II 50kg", quantidade: 10, unidade: "SC", valorUnitario: 38.9 },
        { descricao: "Areia média", quantidade: 2, valorTotal: 300 },
        { descricao: "   " },
      ],
      confiancaExtracao: 0.9,
      camposComBaixaConfianca: [],
    },
    opcoes,
  )!;
  assert.equal(r.origem, "foto");
  assert.equal(r.fornecedorNome, "Casa do Construtor");
  assert.equal(r.dataCompra, "2026-11-20");
  assert.equal(r.obraId, "deposito-1");
  assert.equal(r.comprovanteUrl, opcoes.fotoDataUrl);
  assert.equal(r.itens.length, 2, "item sem descrição sai");
  assert.deepEqual(
    r.itens.map((i) => [i.descricao, i.quantidade, i.valorUnitario, i.valorTotal, i.obraId]),
    [
      ["Cimento CP II 50kg", 10, 38.9, 389, "deposito-1"],
      ["Areia média", 2, 150, 300, "deposito-1"],
    ],
  );
});

test("sem itens legíveis mas com valor: um item único para a pessoa detalhar", () => {
  const r = montarRascunhoDaFoto({ tipoDocumento: "nota_fiscal", valor: 1234.5, confiancaExtracao: 0.6, camposComBaixaConfianca: [] }, opcoes)!;
  assert.equal(r.itens.length, 1);
  assert.equal(r.itens[0].valorTotal, 1234.5);
  assert.equal(r.fornecedorNome, FORNECEDOR_NAO_LIDO);
  assert.equal(r.dataCompra, "2026-11-25", "sem data lida, usa hoje");
});

test("sem itens e sem valor não há o que lançar", () => {
  assert.equal(montarRascunhoDaFoto({ tipoDocumento: "nota_fiscal", confiancaExtracao: 0.5, camposComBaixaConfianca: [] }, opcoes), null);
  assert.equal(montarRascunhoDaFoto({ tipoDocumento: "comprovante", valor: 0, confiancaExtracao: 0.5, camposComBaixaConfianca: [] }, opcoes), null);
});

test("valores negativos ou absurdos da IA não passam; data em formato estranho é ignorada", () => {
  const r = montarRascunhoDaFoto(
    { tipoDocumento: "nota_fiscal", data: "20/11/2026", itens: [{ descricao: "Tijolo", quantidade: -3, valorUnitario: -1 }], valor: 10, confiancaExtracao: 0.5, camposComBaixaConfianca: [] },
    opcoes,
  )!;
  assert.equal(r.itens[0].quantidade, 1);
  assert.equal(r.itens[0].valorUnitario, 0);
  assert.equal(r.dataCompra, "2026-11-25");
  assert.equal(r.dataEmissao, undefined);
});

test("o resumo diz o que falta e que nada entra antes de efetivar", () => {
  const t = textoDoRascunho({ numero: "0012", fornecedor: "Casa do Construtor", qtdItens: 3, total: 1234.5, destino: "Depósito", identificados: 1, link: "https://x/compras/1" });
  assert.match(t, /Compra 0012 lançada como rascunho/);
  assert.match(t, /R\$\s?1\.234,50/);
  assert.match(t, /Falta identificar 2 itens/);
  assert.match(t, /Nada entra nas contas nem no estoque até você efetivar/);
  assert.match(textoDoRascunho({ numero: "1", fornecedor: "X", qtdItens: 1, total: 1, destino: "Depósito", identificados: 1, link: "l" }), /Confira os valores e efetive/);
});
