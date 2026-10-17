import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ContaFinanceira, Obra } from "@/types";
import { progressoObras } from "./dashboardMetrics";
import { calcularResumoFinanceiro } from "./resumoFinanceiro";

const obra = (id: string, orcamentoPrevisto?: number): Obra => ({
  id,
  nome: id,
  cliente: "c",
  status: "em_andamento",
  dataInicio: "2026-01-01",
  orcamentoPrevisto,
  criadoEm: "2026-01-01T00:00:00.000Z",
  atualizadoEm: "2026-01-01T00:00:00.000Z",
});

const conta = (parcial: Partial<ContaFinanceira>): ContaFinanceira => ({
  id: "x",
  tipo: "pagar",
  obraId: "A",
  valor: 100,
  dataLancamento: "2026-01-01",
  dataVencimento: "2026-01-10",
  status: "baixada",
  favorecidoOuCliente: "f",
  descricao: "d",
  comprovanteUrl: "",
  origemNotaFiscal: false,
  precisaCompletarCadastro: false,
  historico: [],
  criadoEm: "2026-01-01T00:00:00.000Z",
  atualizadoEm: "2026-01-01T00:00:00.000Z",
  ...parcial,
});

describe("resumo financeiro do projeto com rateio e materiais do depósito", () => {
  it("sem rateio nem transferência, soma como sempre", () => {
    const r = calcularResumoFinanceiro(obra("A", 1000), [conta({ valor: 300 }), conta({ valor: 200, status: "em_aberto" })]);
    assert.equal(r.totalPago, 300);
    assert.equal(r.totalEmAberto, 200);
    assert.equal(r.totalMateriaisDoDeposito, 0);
    assert.equal(r.saldoOrcamento, 700);
  });
  it("nota dividida conta só a parte do projeto", () => {
    const nota = conta({ valor: 100, obraId: "B", rateios: [{ obraId: "A", valor: 30 }, { obraId: "B", valor: 70 }] });
    assert.equal(calcularResumoFinanceiro(obra("A"), [nota]).totalPago, 30);
    assert.equal(calcularResumoFinanceiro(obra("B"), [nota]).totalPago, 70);
  });
  it("a parte que foi para o Depósito não é gasto de nenhum projeto", () => {
    const nota = conta({ valor: 100, obraId: "A", rateios: [{ obraId: "A", valor: 60 }, { obraId: "DEP", valor: 40 }] });
    assert.equal(calcularResumoFinanceiro(obra("A"), [nota]).totalPago, 60);
  });
  it("material transferido do depósito entra no gasto e abate o orçamento", () => {
    const r = calcularResumoFinanceiro(obra("A", 1000), [conta({ valor: 300 })], 125.5);
    assert.equal(r.totalMateriaisDoDeposito, 125.5);
    assert.equal(r.saldoOrcamento, 1000 - 300 - 125.5);
  });
});

describe("progresso do projeto no dashboard", () => {
  it("soma pago (só a parte do projeto) e materiais transferidos", () => {
    const nota = conta({ valor: 100, obraId: "A", rateios: [{ obraId: "A", valor: 40 }, { obraId: "B", valor: 60 }] });
    const [a, b] = progressoObras([obra("A", 200), obra("B", 200)], [nota], { A: 10 });
    assert.equal(a?.gasto, 50);
    assert.equal(b?.gasto, 60);
    assert.equal(a?.percentual, 25);
  });
  it("o Depósito nunca aparece como projeto", () => {
    const dep = { ...obra("DEP"), ehDeposito: true };
    assert.equal(progressoObras([dep], []).length, 0);
  });
});
