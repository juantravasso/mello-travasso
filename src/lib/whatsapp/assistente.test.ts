import assert from "node:assert/strict";
import { test } from "node:test";
import { acrescentarNaMemoria, agoraNoFuso, emAtendimentoHumano, lerMemoria, MAX_MENSAGENS_NA_MEMORIA, pedeAssistente, pedeAtendente, refsRecentes, semAnotacoesInternas, ehSim, ehNao } from "./assistente";

test("pedeAtendente reconhece os jeitos comuns de pedir uma pessoa", () => {
  for (const t of ["falar com atendente", "Quero falar com um atendente!", "atendente", "preciso falar com alguém", "posso conversar com uma pessoa?", "SUPORTE", "chamar atendimento humano"]) {
    assert.equal(pedeAtendente(t), true, t);
  }
  for (const t of ["quanto tenho para pagar?", "paguei o atendente de manutenção ontem", "resumo do mês", "a pessoa jurídica"]) {
    assert.equal(pedeAtendente(t), false, t);
  }
});

test("pedeAssistente só com o comando curto", () => {
  assert.equal(pedeAssistente("ASSISTENTE"), true);
  assert.equal(pedeAssistente("voltar ao assistente"), true);
  assert.equal(pedeAssistente("o assistente errou o valor"), false);
});

test("atendimento humano vale até o horário gravado", () => {
  const agora = new Date("2026-11-27T12:00:00Z");
  assert.equal(emAtendimentoHumano("2026-11-27T13:00:00.000Z", agora), true);
  assert.equal(emAtendimentoHumano("2026-11-27T11:59:00.000Z", agora), false);
  assert.equal(emAtendimentoHumano(null, agora), false);
});

test("memória: descarta o que é estranho ou tem mais de 24 h e guarda só as últimas trocas", () => {
  const agora = new Date("2026-11-27T12:00:00Z");
  const lidas = lerMemoria(
    [
      { papel: "usuario", texto: "velha", em: "2026-11-26T11:00:00.000Z" },
      { papel: "sistema", texto: "x", em: "2026-11-27T11:00:00.000Z" },
      "lixo",
      { papel: "usuario", texto: "oi", em: "2026-11-27T11:00:00.000Z" },
      { papel: "assistente", texto: "olá", em: "2026-11-27T11:00:01.000Z" },
    ],
    agora,
  );
  assert.deepEqual(lidas.map((m) => m.texto), ["oi", "olá"]);
  assert.deepEqual(lerMemoria({ nada: 1 }, agora), []);
  const muitas = Array.from({ length: 30 }, (_, i) => ({ papel: "usuario" as const, texto: String(i), em: agora.toISOString() }));
  const juntas = acrescentarNaMemoria(muitas, [{ papel: "assistente", texto: "fim", em: agora.toISOString() }]);
  assert.equal(juntas.length, MAX_MENSAGENS_NA_MEMORIA);
  assert.equal(juntas.at(-1)?.texto, "fim");
});

test("o dia de hoje sai no fuso da empresa (à noite em UTC já é amanhã)", () => {
  const noite = new Date("2026-11-28T01:30:00Z");
  assert.equal(agoraNoFuso(noite, "America/Sao_Paulo").hoje, "2026-11-27");
  assert.match(agoraNoFuso(noite, "America/Sao_Paulo").extenso, /sexta-feira/);
});

test("anotação interna nunca vai para o WhatsApp, mesmo que a IA a copie", () => {
  const t = "Você tem 3 contas.\n\n[Contexto interno, não mostrar: 59eed313, 2ec1569b]";
  assert.equal(semAnotacoesInternas(t), "Você tem 3 contas.");
  assert.equal(semAnotacoesInternas("[Contas citadas antes nesta conversa: ref a: x]\nOk"), "Ok");
  assert.equal(semAnotacoesInternas("Valor [aprox.] de R$ 10"), "Valor [aprox.] de R$ 10", "colchete comum fica");
});

test("refs recentes: as da última resposta primeiro, sem repetir", () => {
  const em = "2026-11-27T12:00:00.000Z";
  const r = refsRecentes([
    { papel: "assistente", texto: "a", em, refs: ["ref 1: A", "ref 2: B"] },
    { papel: "usuario", texto: "e a maior?", em },
    { papel: "assistente", texto: "b", em, refs: ["ref 2: B"] },
  ]);
  assert.deepEqual(r, ["ref 2: B", "ref 1: A"]);
});

test("confirmação: só a resposta curta conta como SIM ou NÃO", () => {
  for (const t of ["sim", "Sim!", "SIM", "s", "pode", "Pode lançar", "confirmo", "ok", "isso mesmo", "👍", "👍🏽"]) assert.equal(ehSim(t), true, t);
  for (const t of ["sim, mas o valor é 160", "simples", "não", "pode ser amanhã?", "ok mas muda a data"]) assert.equal(ehSim(t), false, t);
  for (const t of ["não", "Nao", "n", "cancela", "esquece", "Não quero."]) assert.equal(ehNao(t), true, t);
  for (const t of ["não, o valor é 160", "sim", "nada"]) assert.equal(ehNao(t), false, t);
});
