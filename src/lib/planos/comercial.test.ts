import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { centavosParaReais, economiaAnual, planoComercialSchema, reaisParaCentavos } from "./comercial";

const base = { chave: "profissional", nome: "Profissional", descricao: "Para quem gerencia projetos.", precoMensalCentavos: 4990, precoAnualCentavos: 49900, beneficios: ["Contas a pagar"], destaque: false, publicado: true, ordem: 1, vagasTotal: null, parcelasSemJuros: null, condicao: null };

describe("economia anual", () => {
  it("calcula frente a 12 mensalidades", () => {
    assert.deepEqual(economiaAnual({ precoMensalCentavos: 5000, precoAnualCentavos: 48000 }), { centavos: 12000, percentual: 20 });
  });
  it("sem um dos preços não há economia", () => {
    assert.equal(economiaAnual({ precoMensalCentavos: null, precoAnualCentavos: 48000 }), null);
    assert.equal(economiaAnual({ precoMensalCentavos: 5000, precoAnualCentavos: null }), null);
  });
  it("anual igual ou mais caro não anuncia economia", () => {
    assert.equal(economiaAnual({ precoMensalCentavos: 5000, precoAnualCentavos: 60000 }), null);
    assert.equal(economiaAnual({ precoMensalCentavos: 5000, precoAnualCentavos: 70000 }), null);
  });
});

describe("preço digitado", () => {
  it("aceita vírgula, ponto e R$", () => {
    assert.equal(reaisParaCentavos("49,90"), 4990);
    assert.equal(reaisParaCentavos("49.9"), 4990);
    assert.equal(reaisParaCentavos("R$ 100"), 10000);
  });
  it("vazio é sem preço e lixo é recusado", () => {
    assert.equal(reaisParaCentavos("  "), null);
    assert.ok(Number.isNaN(reaisParaCentavos("abc")));
    assert.ok(Number.isNaN(reaisParaCentavos("-5")));
    assert.ok(Number.isNaN(reaisParaCentavos("1.234,56")));
  });
  it("volta para texto", () => {
    assert.equal(centavosParaReais(4990), "49,90");
    assert.equal(centavosParaReais(null), "");
  });
});

describe("validação do plano", () => {
  it("aceita um plano completo", () => assert.ok(planoComercialSchema.safeParse(base).success));
  it("recusa campos extras e chave inválida", () => {
    assert.ok(!planoComercialSchema.safeParse({ ...base, extra: 1 }).success);
    assert.ok(!planoComercialSchema.safeParse({ ...base, chave: "Plano Ruim" }).success);
  });
  it("recusa preço zero, negativo ou fracionado", () => {
    assert.ok(!planoComercialSchema.safeParse({ ...base, precoMensalCentavos: 0 }).success);
    assert.ok(!planoComercialSchema.safeParse({ ...base, precoMensalCentavos: -1 }).success);
    assert.ok(!planoComercialSchema.safeParse({ ...base, precoMensalCentavos: 49.9 }).success);
  });
  it("publicar exige benefício; rascunho não", () => {
    assert.ok(!planoComercialSchema.safeParse({ ...base, beneficios: [] }).success);
    assert.ok(planoComercialSchema.safeParse({ ...base, beneficios: [], publicado: false }).success);
  });
  it("sem preço é válido (sob consulta)", () => {
    assert.ok(planoComercialSchema.safeParse({ ...base, precoMensalCentavos: null, precoAnualCentavos: null }).success);
  });
});

describe("vagas e parcelas", () => {
  it("vagas restantes nunca ficam negativas e sem limite não há contagem", async () => {
    const { vagasRestantes } = await import("./comercial");
    assert.equal(vagasRestantes(10, 3), 7);
    assert.equal(vagasRestantes(10, 10), 0);
    assert.equal(vagasRestantes(10, 14), 0);
    assert.equal(vagasRestantes(null, 5), null);
  });
  it("parcela só existe se o anual divide certo", async () => {
    const { valorDaParcela } = await import("./comercial");
    assert.equal(valorDaParcela(47880, 12), 3990);
    assert.equal(valorDaParcela(76680, 12), 6390);
    assert.equal(valorDaParcela(47881, 12), null);
    assert.equal(valorDaParcela(null, 12), null);
    assert.equal(valorDaParcela(47880, null), null);
  });
  it("diferença anual entre planos", async () => {
    const { diferencaAnualEntrePlanos } = await import("./comercial");
    assert.equal(diferencaAnualEntrePlanos(4990, 7990), 36000);
    assert.equal(diferencaAnualEntrePlanos(7990, 7990), null);
    assert.equal(diferencaAnualEntrePlanos(null, 7990), null);
  });
  it("parcelamento exige anual que divida certo", async () => {
    const { planoComercialSchema } = await import("./comercial");
    const b = { chave: "fundador", nome: "Fundador", descricao: "Plano de fundador.", precoMensalCentavos: 4990, precoAnualCentavos: 47880, beneficios: ["x1"], destaque: true, publicado: true, ordem: 1, vagasTotal: 10, parcelasSemJuros: 12, condicao: null };
    assert.ok(planoComercialSchema.safeParse(b).success);
    assert.ok(!planoComercialSchema.safeParse({ ...b, precoAnualCentavos: 47881 }).success);
    assert.ok(!planoComercialSchema.safeParse({ ...b, precoAnualCentavos: null }).success);
    assert.ok(!planoComercialSchema.safeParse({ ...b, vagasTotal: 0 }).success);
  });
});
