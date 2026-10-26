import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { datasDoHistorico, empresaAtivada, formatarTaxa, periodoValido, retencaoSemanal, semanaDoCadastro, taxa, testeAmadurecido, testeConvertido } from "./formulas";

const agora = new Date("2026-10-20T15:00:00Z");

describe("taxa", () => {
  it("sem total não existe taxa (nunca 0%)", () => {
    assert.equal(taxa(0, 0), null);
    assert.equal(taxa(3, 0), null);
  });
  it("calcula parte sobre total e limita a 100%", () => {
    assert.equal(taxa(1, 4), 0.25);
    assert.equal(taxa(5, 4), 1);
    assert.equal(taxa(-1, 4), 0);
  });
  it("rejeita valores que não são número", () => {
    assert.equal(taxa(Number.NaN, 4), null);
    assert.equal(taxa(1, Number.POSITIVE_INFINITY), null);
  });
  it("formata em português", () => {
    assert.equal(formatarTaxa(null), "—");
    assert.equal(formatarTaxa(0.5), "50%");
    assert.equal(formatarTaxa(1 / 3), "33,3%");
  });
});

describe("período", () => {
  it("só aceita os períodos previstos", () => {
    assert.ok(periodoValido(7) && periodoValido(30) && periodoValido(90));
    assert.ok(!periodoValido(15) && !periodoValido("30") && !periodoValido(null));
  });
});

describe("ativação", () => {
  const vazio = { contas: 0, obras: 0, produtos: 0, compromissos: 0, perfilPublicado: false };
  it("só entrar não ativa", () => assert.equal(empresaAtivada(vazio), false));
  it("qualquer fato real ativa", () => {
    assert.ok(empresaAtivada({ ...vazio, obras: 1 }));
    assert.ok(empresaAtivada({ ...vazio, contas: 2 }));
    assert.ok(empresaAtivada({ ...vazio, produtos: 1 }));
    assert.ok(empresaAtivada({ ...vazio, compromissos: 1 }));
    assert.ok(empresaAtivada({ ...vazio, perfilPublicado: true }));
  });
});

describe("conversão do teste", () => {
  it("teste em andamento não amadureceu", () => {
    assert.equal(testeAmadurecido({ plano: "teste", testeTerminaEm: "2026-10-25T02:59:00.000Z" }, agora), false);
  });
  it("prazo vencido amadureceu, mesmo sem mudar de plano", () => {
    assert.equal(testeAmadurecido({ plano: "teste", testeTerminaEm: "2026-10-19T02:59:00.000Z" }, agora), true);
  });
  it("quem mudou de plano amadureceu", () => {
    assert.equal(testeAmadurecido({ plano: "ativo", testeTerminaEm: null }, agora), true);
    assert.equal(testeAmadurecido({ plano: "gratuito", testeTerminaEm: null }, agora), true);
  });
  it("teste sem data de fim não amadurece (dado incompleto não vira conversão nem perda)", () => {
    assert.equal(testeAmadurecido({ plano: "teste", testeTerminaEm: null }, agora), false);
  });
  it("só o plano ativo conta como convertido; cortesia não", () => {
    assert.equal(testeConvertido({ plano: "ativo", testeTerminaEm: null }), true);
    assert.equal(testeConvertido({ plano: "cortesia", testeTerminaEm: null }), false);
    assert.equal(testeConvertido({ plano: "teste", testeTerminaEm: null }), false);
  });
});

describe("retenção semanal", () => {
  const cadastro = "2026-09-01T12:00:00.000Z";

  it("semana 1 são os 7 primeiros dias; antes do cadastro ou data inválida não tem semana", () => {
    assert.equal(semanaDoCadastro(cadastro, cadastro), 1);
    assert.equal(semanaDoCadastro(cadastro, "2026-09-08T11:59:59.000Z"), 1);
    assert.equal(semanaDoCadastro(cadastro, "2026-09-08T12:00:00.000Z"), 2);
    assert.equal(semanaDoCadastro(cadastro, "2026-09-01T11:00:00.000Z"), null);
    assert.equal(semanaDoCadastro(cadastro, "não é data"), null);
  });

  it("lê só as datas válidas do histórico da conta", () => {
    assert.deepEqual(datasDoHistorico([{ tipo: "baixa", data: "2026-09-10T10:00:00.000Z" }, { tipo: "edicao" }, null, 3]), ["2026-09-10T10:00:00.000Z"]);
    assert.deepEqual(datasDoHistorico(null), []);
    assert.deepEqual(datasDoHistorico({ data: "2026-09-10T10:00:00.000Z" }), []);
  });

  it("só entra na base da semana quem já a completou", () => {
    const empresas = [
      { id: "antiga", criadoEm: "2026-09-01T12:00:00.000Z" },
      { id: "nova", criadoEm: "2026-10-10T12:00:00.000Z" },
    ];
    const semanas = retencaoSemanal(empresas, [], agora);
    assert.deepEqual(
      semanas.map((s) => s.base),
      [2, 1, 1, 1],
    );
  });

  it("conta a empresa uma vez por semana, na semana em que agiu", () => {
    const empresas = [
      { id: "a", criadoEm: cadastro },
      { id: "b", criadoEm: cadastro },
    ];
    const atividades = [
      { empresaId: "a", em: "2026-09-02T10:00:00.000Z" },
      { empresaId: "a", em: "2026-09-03T10:00:00.000Z" },
      { empresaId: "a", em: "2026-09-25T10:00:00.000Z" },
      { empresaId: "b", em: "2026-09-02T10:00:00.000Z" },
      { empresaId: "fora-da-coorte", em: "2026-09-02T10:00:00.000Z" },
      { empresaId: "b", em: "2026-08-30T10:00:00.000Z" },
    ];
    assert.deepEqual(retencaoSemanal(empresas, atividades, agora), [
      { semana: 1, base: 2, retidas: 2 },
      { semana: 2, base: 2, retidas: 0 },
      { semana: 3, base: 2, retidas: 0 },
      { semana: 4, base: 2, retidas: 1 },
    ]);
  });
});
