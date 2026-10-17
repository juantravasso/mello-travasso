import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { adicionarDias, dataLocal, diferencaEmDias, ehDataValida, ehHoraValida, fimDoDiaLocal, instanteLocal, periodoDoCompromisso } from "./tempo";

const SP = "America/Sao_Paulo";

describe("validação de data e hora", () => {
  it("aceita datas reais e recusa as que não existem", () => {
    assert.equal(ehDataValida("2026-10-20"), true);
    assert.equal(ehDataValida("2028-02-29"), true);
    assert.equal(ehDataValida("2026-02-29"), false);
    assert.equal(ehDataValida("2026-13-01"), false);
    assert.equal(ehDataValida("20/10/2026"), false);
  });
  it("aceita só horas de 00:00 a 23:59", () => {
    assert.equal(ehHoraValida("00:00"), true);
    assert.equal(ehHoraValida("23:59"), true);
    assert.equal(ehHoraValida("24:00"), false);
    assert.equal(ehHoraValida("9:00"), false);
  });
  it("soma dias atravessando mês e ano", () => {
    assert.equal(adicionarDias("2026-10-31", 1), "2026-11-01");
    assert.equal(adicionarDias("2026-01-01", -1), "2025-12-31");
    assert.equal(diferencaEmDias("2026-10-01", "2026-10-31"), 30);
  });
});

describe("fusos horários", () => {
  it("Brasília: 14:00 locais são 17:00 UTC", () => {
    assert.equal(instanteLocal("2026-10-20", "14:00", SP).toISOString(), "2026-10-20T17:00:00.000Z");
  });
  it("Manaus fica uma hora atrás de Brasília", () => {
    assert.equal(instanteLocal("2026-10-20", "10:00", "America/Manaus").toISOString(), "2026-10-20T14:00:00.000Z");
  });
  it("a data local muda de dia antes do UTC (22h em Brasília já é o dia seguinte em UTC)", () => {
    const instante = new Date("2026-10-21T01:30:00.000Z");
    assert.equal(dataLocal(instante, SP), "2026-10-20");
    assert.equal(dataLocal(instante, "UTC"), "2026-10-21");
  });
  it("respeita o horário de verão de fusos que o têm (Nova York)", () => {
    assert.equal(instanteLocal("2026-01-15", "12:00", "America/New_York").toISOString(), "2026-01-15T17:00:00.000Z");
    assert.equal(instanteLocal("2026-07-01", "12:00", "America/New_York").toISOString(), "2026-07-01T16:00:00.000Z");
  });
  it("converte de ida e volta sem perder o dia", () => {
    for (const fuso of [SP, "America/Manaus", "America/Noronha", "America/Rio_Branco"]) {
      assert.equal(dataLocal(instanteLocal("2026-12-31", "23:30", fuso), fuso), "2026-12-31");
      assert.equal(dataLocal(instanteLocal("2026-12-31", "00:00", fuso), fuso), "2026-12-31");
    }
  });
});

describe("período do compromisso", () => {
  it("com horário: início e término no fuso da empresa", () => {
    const p = periodoDoCompromisso({ data: "2026-10-20", diaInteiro: false, horaInicio: "14:00", horaFim: "15:30" }, SP);
    assert.equal(p.inicioEm, "2026-10-20T17:00:00.000Z");
    assert.equal(p.fimEm, "2026-10-20T18:30:00.000Z");
  });
  it("sem término, o fim é o próprio início", () => {
    const p = periodoDoCompromisso({ data: "2026-10-20", diaInteiro: false, horaInicio: "14:00" }, SP);
    assert.equal(p.fimEm, p.inicioEm);
  });
  it("dia inteiro vai da meia-noite local ao último instante do dia local", () => {
    const p = periodoDoCompromisso({ data: "2026-10-20", diaInteiro: true }, SP);
    assert.equal(p.inicioEm, "2026-10-20T03:00:00.000Z");
    assert.equal(p.fimEm, "2026-10-21T02:59:59.999Z");
    assert.equal(fimDoDiaLocal("2026-10-20", SP).toISOString(), p.fimEm);
  });
  it("compromisso com horário exige a hora de início", () => {
    assert.throws(() => periodoDoCompromisso({ data: "2026-10-20", diaInteiro: false }, SP));
  });
});
