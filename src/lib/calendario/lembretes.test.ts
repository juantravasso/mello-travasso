import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ConfigLembretes } from "./config";
import { agendarLembretes, aindaFazSentidoAvisar, calcularDisparos, planejarReagendamento, type CompromissoParaLembretes } from "./lembretes";
import { periodoDoCompromisso } from "./tempo";

const SP = "America/Sao_Paulo";
const CONFIG: ConfigLembretes = { horaDiaInteiro: 9, horaDoDia: 8, antecedenciaDoDiaMin: 60 };

function comHorario(data: string, hora: string): CompromissoParaLembretes {
  return { data, diaInteiro: false, horaInicio: hora, fuso: SP, inicioEm: periodoDoCompromisso({ data, diaInteiro: false, horaInicio: hora }, SP).inicioEm };
}
function diaInteiro(data: string): CompromissoParaLembretes {
  return { data, diaInteiro: true, horaInicio: null, fuso: SP, inicioEm: periodoDoCompromisso({ data, diaInteiro: true }, SP).inicioEm };
}
const iso = (d: Date) => d.toISOString();

describe("quando cada lembrete sai", () => {
  it("com horário: a véspera sai 24 h antes do início", () => {
    const d = calcularDisparos(comHorario("2026-10-20", "14:00"), CONFIG);
    assert.equal(iso(d.vespera), "2026-10-19T17:00:00.000Z"); // 14:00 de Brasília da véspera
  });
  it("com horário: o lembrete do dia sai às 8h locais", () => {
    const d = calcularDisparos(comHorario("2026-10-20", "14:00"), CONFIG);
    assert.equal(iso(d.dia), "2026-10-20T11:00:00.000Z"); // 08:00 de Brasília
  });
  it("evento logo cedo: o do dia sai 60 min antes do início, nunca depois dele", () => {
    const d = calcularDisparos(comHorario("2026-10-20", "08:30"), CONFIG);
    assert.equal(iso(d.dia), "2026-10-20T10:30:00.000Z"); // 07:30 locais
    const tarde = calcularDisparos(comHorario("2026-10-20", "07:00"), CONFIG);
    assert.equal(iso(tarde.dia), "2026-10-20T09:00:00.000Z"); // 06:00 locais
  });
  it("evento de madrugada: o lembrete do dia não volta para o dia anterior", () => {
    const d = calcularDisparos(comHorario("2026-10-20", "00:30"), CONFIG);
    assert.equal(iso(d.dia), "2026-10-20T03:00:00.000Z"); // 00:00 locais do próprio dia
  });
  it("dia inteiro: véspera e dia saem na hora padrão configurada", () => {
    const d = calcularDisparos(diaInteiro("2026-10-20"), CONFIG);
    assert.equal(iso(d.vespera), "2026-10-19T12:00:00.000Z"); // 09:00 locais do dia anterior
    assert.equal(iso(d.dia), "2026-10-20T12:00:00.000Z");
  });
  it("a hora padrão do dia inteiro é configurável", () => {
    const d = calcularDisparos(diaInteiro("2026-10-20"), { ...CONFIG, horaDiaInteiro: 7 });
    assert.equal(iso(d.dia), "2026-10-20T10:00:00.000Z");
  });
  it("respeita o fuso da empresa (Manaus)", () => {
    const c: CompromissoParaLembretes = { data: "2026-10-20", diaInteiro: false, horaInicio: "14:00", fuso: "America/Manaus", inicioEm: "2026-10-20T18:00:00.000Z" };
    assert.equal(iso(calcularDisparos(c, CONFIG).dia), "2026-10-20T12:00:00.000Z"); // 08:00 em Manaus
  });
});

describe("lembretes que ainda fazem sentido agendar", () => {
  const c = comHorario("2026-10-20", "14:00");
  it("criado com antecedência: os dois", () => {
    const r = agendarLembretes(c, new Date("2026-10-10T12:00:00Z"), CONFIG);
    assert.deepEqual(r.map((x) => x.tipo), ["vespera", "dia"]);
  });
  it("criado depois da hora da véspera: só o do dia (sem aviso retroativo)", () => {
    const r = agendarLembretes(c, new Date("2026-10-19T20:00:00Z"), CONFIG);
    assert.deepEqual(r.map((x) => x.tipo), ["dia"]);
  });
  it("criado depois dos dois horários: nenhum", () => {
    assert.deepEqual(agendarLembretes(c, new Date("2026-10-20T12:00:00Z"), CONFIG), []);
  });
});

describe("compromisso que ainda justifica um aviso", () => {
  const base = { fimEm: "2026-10-20T18:00:00.000Z" };
  it("agendado e ainda por acontecer", () => assert.equal(aindaFazSentidoAvisar({ ...base, status: "agendado" }, new Date("2026-10-20T12:00:00Z")), true));
  it("concluído ou cancelado não avisa", () => {
    assert.equal(aindaFazSentidoAvisar({ ...base, status: "concluido" }, new Date("2026-10-19T12:00:00Z")), false);
    assert.equal(aindaFazSentidoAvisar({ ...base, status: "cancelado" }, new Date("2026-10-19T12:00:00Z")), false);
  });
  it("já encerrado não avisa", () => assert.equal(aindaFazSentidoAvisar({ ...base, status: "agendado" }, new Date("2026-10-20T18:00:01Z")), false));
});

describe("reagendamento depois de uma edição", () => {
  const vespera = { tipo: "vespera" as const, disparoEm: "2026-10-19T17:00:00.000Z", status: "pendente" as const, versao: 1 };
  const dia = { tipo: "dia" as const, disparoEm: "2026-10-20T11:00:00.000Z", status: "pendente" as const, versao: 1 };

  it("sem lembretes ainda: cria os dois", () => {
    const acoes = planejarReagendamento([], [{ tipo: "vespera", disparoEm: vespera.disparoEm }, { tipo: "dia", disparoEm: dia.disparoEm }]);
    assert.deepEqual(acoes.map((a) => a.acao), ["criar", "criar"]);
  });
  it("edição que não mexe na data mantém tudo (nada é reenviado)", () => {
    const acoes = planejarReagendamento([vespera, dia], [{ tipo: "vespera", disparoEm: vespera.disparoEm }, { tipo: "dia", disparoEm: dia.disparoEm }]);
    assert.deepEqual(acoes.map((a) => a.acao), ["manter", "manter"]);
  });
  it("mudar o horário atualiza e sobe a versão, mesmo já enviado", () => {
    const enviado = { ...vespera, status: "processado" as const };
    const acoes = planejarReagendamento([enviado, dia], [{ tipo: "vespera", disparoEm: "2026-10-26T17:00:00.000Z" }, { tipo: "dia", disparoEm: "2026-10-27T11:00:00.000Z" }]);
    assert.deepEqual(acoes[0], { tipo: "vespera", acao: "atualizar", disparoEm: "2026-10-26T17:00:00.000Z", versao: 2 });
    assert.equal(acoes[1]?.acao, "atualizar");
  });
  it("horário novo que já passou: um lembrete ainda pendente é ignorado", () => {
    const acoes = planejarReagendamento([vespera, dia], [{ tipo: "dia", disparoEm: dia.disparoEm }]);
    assert.equal(acoes[0]?.acao, "ignorar");
    assert.equal(acoes[1]?.acao, "manter");
  });
  it("horário novo que já passou: um lembrete já enviado fica como está", () => {
    const enviado = { ...vespera, status: "processado" as const };
    assert.equal(planejarReagendamento([enviado], [])[0]?.acao, "manter");
  });
  it("compromisso reativado: o lembrete ignorado volta a valer com versão nova", () => {
    const ignorado = { ...vespera, status: "ignorado" as const };
    const acao = planejarReagendamento([ignorado], [{ tipo: "vespera", disparoEm: vespera.disparoEm }])[0];
    assert.deepEqual(acao, { tipo: "vespera", acao: "atualizar", disparoEm: vespera.disparoEm, versao: 2 });
  });
});
