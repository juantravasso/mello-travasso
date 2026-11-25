import assert from "node:assert/strict";
import { test } from "node:test";
import { dentroDoHorario, horaNoFuso, proximaTentativa, tetoDiario, TETO_DIARIO_PADRAO, textoFimDoTeste, textoPlanoSuspenso, textoRenovacao } from "./avisos";

test("horário de envio é o do fuso da empresa, das 8h às 20h", () => {
  const meioDiaSP = new Date("2026-11-25T15:00:00Z"); // 12h em São Paulo
  assert.equal(horaNoFuso(meioDiaSP, "America/Sao_Paulo"), 12);
  assert.equal(dentroDoHorario(meioDiaSP, "America/Sao_Paulo"), true);
  assert.equal(dentroDoHorario(new Date("2026-11-25T10:59:00Z"), "America/Sao_Paulo"), false, "7h59 ainda não");
  assert.equal(dentroDoHorario(new Date("2026-11-25T11:00:00Z"), "America/Sao_Paulo"), true, "8h já pode");
  assert.equal(dentroDoHorario(new Date("2026-11-25T23:00:00Z"), "America/Sao_Paulo"), false, "20h não");
  assert.equal(dentroDoHorario(new Date("2026-11-25T15:00:00Z"), "America/Manaus"), true);
  assert.equal(horaNoFuso(meioDiaSP, "Fuso/Inexistente"), 12, "fuso inválido cai em São Paulo");
});

test("teto diário vem do ambiente, com padrão e limites", () => {
  assert.equal(tetoDiario(undefined), TETO_DIARIO_PADRAO);
  assert.equal(tetoDiario("25"), 25);
  assert.equal(tetoDiario("0"), 0);
  assert.equal(tetoDiario("-3"), TETO_DIARIO_PADRAO);
  assert.equal(tetoDiario("abc"), TETO_DIARIO_PADRAO);
});

test("novas tentativas espaçam: 15 min, 1 h, 4 h", () => {
  const agora = new Date("2026-11-25T12:00:00Z");
  assert.equal(proximaTentativa(agora, 1).getTime() - agora.getTime(), 60 * 60_000);
  assert.equal(proximaTentativa(agora, 0).getTime() - agora.getTime(), 15 * 60_000);
  assert.equal(proximaTentativa(agora, 9).getTime() - agora.getTime(), 240 * 60_000);
});

test("textos dizem o essencial, levam o link e explicam como desligar", () => {
  const fim = textoFimDoTeste(1, "2026-11-26T12:00:00Z", "https://x/planos");
  assert.match(fim, /termina amanhã \(26\/11\/2026\)/);
  assert.match(fim, /https:\/\/x\/planos/);
  assert.match(fim, /Configurações → WhatsApp/);
  assert.match(textoFimDoTeste(0, "2026-11-26T12:00:00Z", "l"), /termina hoje/);
  assert.match(textoFimDoTeste(3, "2026-11-26T12:00:00Z", "l"), /termina em 3 dias/);
  assert.match(textoRenovacao("anual", "Profissional", "2026-12-10T12:00:00Z", "l"), /assinatura anual do plano Profissional vence em 10\/12\/2026/);
  assert.match(textoPlanoSuspenso("Profissional", "l"), /somente leitura/);
});
