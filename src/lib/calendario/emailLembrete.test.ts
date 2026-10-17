import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dataPorExtenso, montarEmailLembrete, quandoTexto, textoNotificacao, type DadosEmailLembrete } from "./emailLembrete";

const base: DadosEmailLembrete = {
  tipo: "vespera",
  titulo: "Reunião com o cliente",
  descricao: "Levar a planilha de custos",
  data: "2026-10-20",
  diaInteiro: false,
  horaInicio: "14:00",
  horaFim: "15:30",
  criadoPorNome: "Ana Souza",
  compartilhado: false,
  link: "https://exemplo.test/calendario?evento=abc",
};

describe("e-mail de lembrete", () => {
  it("a véspera diz que é amanhã; o do dia diz que é hoje", () => {
    assert.equal(montarEmailLembrete(base).assunto, "Lembrete (amanhã): Reunião com o cliente");
    assert.equal(montarEmailLembrete({ ...base, tipo: "dia" }).assunto, "Lembrete (hoje): Reunião com o cliente");
    assert.match(montarEmailLembrete(base).texto, /é amanhã/);
    assert.match(montarEmailLembrete({ ...base, tipo: "dia" }).texto, /é hoje/);
  });
  it("traz título, data e horário, descrição, autor e o link", () => {
    const m = montarEmailLembrete(base);
    for (const parte of ["Reunião com o cliente", "terça-feira, 20 de outubro de 2026", "14:00", "15:30", "Levar a planilha de custos", "Ana Souza", base.link]) {
      assert.ok(m.texto.includes(parte), `texto sem "${parte}"`);
      assert.ok(m.html.includes(parte), `html sem "${parte}"`);
    }
  });
  it("informa o compartilhamento só quando é o caso", () => {
    assert.match(montarEmailLembrete({ ...base, compartilhado: true }).texto, /Ana Souza compartilhou este compromisso com você/);
    assert.match(montarEmailLembrete(base).texto, /Criado por Ana Souza/);
  });
  it("dia inteiro não mostra horário", () => {
    assert.equal(quandoTexto({ ...base, diaInteiro: true, horaInicio: null, horaFim: null }), "terça-feira, 20 de outubro de 2026, dia inteiro");
  });
  it("escapa HTML de texto digitado pelo usuário (título e descrição)", () => {
    const m = montarEmailLembrete({ ...base, titulo: '<script>alert("x")</script>', descricao: "<img src=x onerror=1>" });
    assert.ok(!m.html.includes("<script>"));
    assert.ok(!m.html.includes("<img"));
    assert.ok(m.html.includes("&lt;script&gt;"));
  });
  it("o HTML é responsivo e tem a identidade da marca", () => {
    const html = montarEmailLembrete(base).html;
    assert.match(html, /name="viewport"/);
    assert.match(html, /max-width:560px/);
    assert.match(html, /Elo <span[^>]*>Negócios/);
  });
  it("formata a data por extenso sem depender do fuso do servidor", () => assert.equal(dataPorExtenso("2026-12-25"), "sexta-feira, 25 de dezembro de 2026"));
});

describe("texto da notificação no app", () => {
  it("véspera e dia", () => {
    assert.deepEqual(textoNotificacao(base), { titulo: "Amanhã: Reunião com o cliente", texto: "Amanhã, às 14:00." });
    assert.equal(textoNotificacao({ ...base, tipo: "dia" }).titulo, "Hoje: Reunião com o cliente");
  });
  it("cita quem compartilhou", () => assert.match(textoNotificacao({ ...base, compartilhado: true }).texto, /Compartilhado por Ana Souza/));
});
