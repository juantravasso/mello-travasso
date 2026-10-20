import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { campanhaSeAplica, CATEGORIA_DA_CAMPANHA, montarEmail, recursosNaoUsados, type CampanhaId, type ContextoEmail, type SinaisDaEmpresa } from "./campanhas";
import { CONFIG_PADRAO, configCicloSchema, lerConfigCiclo } from "./config";
import {
  avisoDeFimEstaNaJanela,
  campanhaEstaDevida,
  diasAteOFim,
  DIA_MS,
  fimDepoisDaExtensao,
  fimDoDiaLocal,
  fimDoTesteEmDias,
  momentoDoAvisoDeFim,
} from "./datas";
import { avaliarExtensao } from "./extensao";

const novo = (s: Partial<SinaisDaEmpresa> = {}): SinaisDaEmpresa => ({ plano: "teste", contas: 0, obras: 0, produtos: 0, compromissos: 0, perfilPublicado: false, ...s });
const ctx = (s: Partial<SinaisDaEmpresa> = {}, extra: Partial<ContextoEmail> = {}): ContextoEmail => ({
  nome: "Maria Souza",
  urlSite: "https://www.exemplo.com.br/",
  sinais: novo(s),
  diasDeTeste: 14,
  ...extra,
});

describe("datas do teste", () => {
  it("o fim do teste é sempre 23:59 de Brasília (02:59 UTC do dia seguinte)", () => {
    // 20/10/2026 10:00 em Brasília = 13:00 UTC; 14 dias depois, 03/11 às 23:59 locais.
    const fim = fimDoTesteEmDias(new Date("2026-10-20T13:00:00Z"), 14);
    assert.equal(fim.toISOString(), "2026-11-04T02:59:00.000Z");
  });

  it("à noite em Brasília (já é outro dia em UTC) conta o dia local, não o de UTC", () => {
    // 20/10/2026 22:30 em Brasília = 21/10 01:30 UTC. O fim deve cair no dia 3/11 local, não 4/11.
    const fim = fimDoTesteEmDias(new Date("2026-10-21T01:30:00Z"), 14);
    assert.equal(fim.toISOString(), "2026-11-04T02:59:00.000Z");
  });

  it("fimDoDiaLocal é idempotente", () => {
    const fim = fimDoDiaLocal(new Date("2026-10-20T13:00:00Z"));
    assert.equal(fimDoDiaLocal(fim).getTime(), fim.getTime());
  });

  it("extensão soma ao fim atual quando o teste ainda não venceu", () => {
    const agora = new Date("2026-10-20T13:00:00Z");
    const fimAtual = new Date("2026-10-25T02:59:00Z");
    assert.equal(fimDepoisDaExtensao(fimAtual, agora, 7).toISOString(), "2026-11-01T02:59:00.000Z");
  });

  it("extensão de teste já vencido conta a partir de hoje, nunca do fim antigo", () => {
    const agora = new Date("2026-10-20T13:00:00Z");
    const vencido = new Date("2026-09-01T02:59:00Z");
    const novoFim = fimDepoisDaExtensao(vencido, agora, 7);
    assert.ok(novoFim.getTime() > agora.getTime());
    assert.equal(novoFim.toISOString(), "2026-10-28T02:59:00.000Z");
  });

  it("dias até o fim arredonda para cima, como a faixa do app", () => {
    const fim = new Date("2026-10-25T02:59:00Z");
    assert.equal(diasAteOFim(fim, new Date("2026-10-22T13:00:00Z")), 3);
    assert.equal(diasAteOFim(fim, new Date("2026-10-24T13:00:00Z")), 1);
  });
});

describe("janelas de aviso e de campanha", () => {
  const fim = new Date("2026-10-25T02:59:00Z"); // termina 24/10 às 23:59 de Brasília

  it("o aviso D-0 vale a partir das 00:00 do dia do término", () => {
    assert.equal(momentoDoAvisoDeFim(fim, 0).toISOString(), "2026-10-24T03:00:00.000Z");
    assert.equal(avisoDeFimEstaNaJanela(fim, 0, new Date("2026-10-24T02:59:00Z")), false);
    assert.equal(avisoDeFimEstaNaJanela(fim, 0, new Date("2026-10-24T15:00:00Z")), true);
  });

  it("o aviso D-3 sai 3 dias antes e some depois da tolerância", () => {
    assert.equal(avisoDeFimEstaNaJanela(fim, 3, new Date("2026-10-21T15:00:00Z")), true);
    assert.equal(avisoDeFimEstaNaJanela(fim, 3, new Date("2026-10-20T15:00:00Z")), false, "ainda não chegou");
    assert.equal(avisoDeFimEstaNaJanela(fim, 3, new Date("2026-10-24T15:00:00Z")), false, "atrasado demais");
  });

  it("nenhum aviso sai depois do fim do teste", () => {
    assert.equal(avisoDeFimEstaNaJanela(fim, 0, new Date("2026-10-25T03:30:00Z")), false);
  });

  it("campanha de N dias vale a partir do dia N e por 3 dias", () => {
    const criado = new Date("2026-10-20T12:00:00Z");
    assert.equal(campanhaEstaDevida(criado, 1, new Date(criado.getTime() + DIA_MS - 1000)), false);
    assert.equal(campanhaEstaDevida(criado, 1, new Date(criado.getTime() + DIA_MS + 1000)), true);
    assert.equal(campanhaEstaDevida(criado, 1, new Date(criado.getTime() + 5 * DIA_MS)), false, "passou da tolerância");
  });
});

describe("regras de extensão", () => {
  const config = { ativa: true, maxExtensoes: 2, maxDiasPorExtensao: 10, maxDiasTotal: 15 };
  const base = { config, plano: "teste", extensoesAnteriores: [] as number[], dias: 7 };

  it("aceita uma extensão dentro dos limites", () => {
    assert.deepEqual(avaliarExtensao(base), { ok: true });
  });

  it("recusa quando as extensões estão desativadas", () => {
    assert.equal(avaliarExtensao({ ...base, config: { ...config, ativa: false } }).ok, false);
  });

  it("recusa empresa fora do plano de teste", () => {
    for (const plano of ["ativo", "cortesia", "gratuito", "suspenso"]) assert.equal(avaliarExtensao({ ...base, plano }).ok, false, plano);
  });

  it("recusa dias inválidos ou acima do limite por extensão", () => {
    for (const dias of [0, -3, 1.5, 11, Number.NaN]) assert.equal(avaliarExtensao({ ...base, dias }).ok, false, String(dias));
  });

  it("recusa passar do número de extensões", () => {
    assert.equal(avaliarExtensao({ ...base, extensoesAnteriores: [3, 3] }).ok, false);
  });

  it("recusa passar do total de dias, dizendo quantos restam", () => {
    const r = avaliarExtensao({ ...base, extensoesAnteriores: [10], dias: 7 });
    assert.equal(r.ok, false);
    assert.match(r.ok ? "" : r.mensagem, /Restam 5/);
  });

  it("aceita exatamente até o total", () => {
    assert.deepEqual(avaliarExtensao({ ...base, extensoesAnteriores: [10], dias: 5 }), { ok: true });
  });
});

describe("configuração", () => {
  it("padrão: teste de 14 dias, e-mails desligados, uma extensão de até 14 dias", () => {
    assert.equal(CONFIG_PADRAO.testeDias, 14);
    assert.equal(CONFIG_PADRAO.emails.ativos, false);
    assert.equal(CONFIG_PADRAO.extensao.maxExtensoes, 1);
    assert.equal(configCicloSchema.safeParse(CONFIG_PADRAO).success, true);
  });

  it("valor ausente ou corrompido volta ao padrão", () => {
    assert.deepEqual(lerConfigCiclo(null), CONFIG_PADRAO);
    assert.deepEqual(lerConfigCiclo({ testeDias: "muitos" }), CONFIG_PADRAO);
    assert.deepEqual(lerConfigCiclo({ ...CONFIG_PADRAO, extra: 1 }), CONFIG_PADRAO, "campo desconhecido é recusado (strict)");
  });

  it("recusa duração do teste fora de 1 a 90 dias e limite por extensão acima do total", () => {
    assert.equal(configCicloSchema.safeParse({ ...CONFIG_PADRAO, testeDias: 0 }).success, false);
    assert.equal(configCicloSchema.safeParse({ ...CONFIG_PADRAO, testeDias: 91 }).success, false);
    assert.equal(configCicloSchema.safeParse({ ...CONFIG_PADRAO, extensao: { ...CONFIG_PADRAO.extensao, maxDiasPorExtensao: 20, maxDiasTotal: 10 } }).success, false);
  });

  it("os dias de aviso do fim do teste saem sem repetição e do maior para o menor", () => {
    const r = configCicloSchema.parse({ ...CONFIG_PADRAO, emails: { ...CONFIG_PADRAO.emails, fimDoTeste: { ativa: true, diasAntes: [1, 3, 1, 0] } } });
    assert.deepEqual(r.emails.fimDoTeste.diasAntes, [3, 1, 0]);
  });
});

describe("quando cada campanha se aplica", () => {
  it("primeira ação (teste) só sai para quem ainda não lançou nenhuma conta", () => {
    assert.equal(campanhaSeAplica("primeira_acao", novo({ contas: 0 })), true);
    assert.equal(campanhaSeAplica("primeira_acao", novo({ contas: 1 })), false);
  });

  it("primeira ação (só rede) só sai para quem ainda não publicou o perfil", () => {
    assert.equal(campanhaSeAplica("primeira_acao", novo({ plano: "gratuito", perfilPublicado: false })), true);
    assert.equal(campanhaSeAplica("primeira_acao", novo({ plano: "gratuito", perfilPublicado: true })), false);
  });

  it("a dica do problema some quando estoque e calendário já foram usados", () => {
    assert.equal(campanhaSeAplica("problema", novo({ produtos: 3, compromissos: 2 })), false);
    assert.equal(campanhaSeAplica("problema", novo({ produtos: 3, compromissos: 0 })), true);
  });

  it("recursos não usados lista só o que falta, na ordem", () => {
    assert.deepEqual(recursosNaoUsados(novo()), ["captura", "estoque", "calendario"]);
    assert.deepEqual(recursosNaoUsados(novo({ contas: 2, compromissos: 1 })), ["estoque"]);
    assert.equal(campanhaSeAplica("recursos", novo({ contas: 2, produtos: 1, compromissos: 1 })), false);
  });

  it("fim do teste e extensão só valem para quem está em teste", () => {
    for (const c of ["fim_do_teste", "teste_estendido"] as CampanhaId[]) {
      assert.equal(campanhaSeAplica(c, novo({ plano: "teste" })), true);
      for (const plano of ["ativo", "cortesia", "gratuito"]) assert.equal(campanhaSeAplica(c, novo({ plano })), false, `${c}/${plano}`);
    }
  });

  it("empresa ativa ou cortesia não recebe campanha de onboarding", () => {
    for (const c of ["boas_vindas", "primeira_acao", "problema", "recursos"] as CampanhaId[]) {
      assert.equal(campanhaSeAplica(c, novo({ plano: "ativo" })), false, c);
      assert.equal(campanhaSeAplica(c, novo({ plano: "cortesia" })), false, c);
    }
  });
});

describe("modelos de e-mail", () => {
  const TODAS: CampanhaId[] = ["boas_vindas", "primeira_acao", "problema", "recursos", "fim_do_teste", "teste_estendido"];

  it("só fim do teste, boas-vindas e extensão são transacionais; as dicas são promocionais", () => {
    assert.equal(CATEGORIA_DA_CAMPANHA.fim_do_teste, "transacional");
    assert.equal(CATEGORIA_DA_CAMPANHA.boas_vindas, "transacional");
    assert.equal(CATEGORIA_DA_CAMPANHA.teste_estendido, "transacional");
    for (const c of ["primeira_acao", "problema", "recursos"] as CampanhaId[]) assert.equal(CATEGORIA_DA_CAMPANHA[c], "promocional");
  });

  it("todo e-mail tem assunto, texto e HTML, com um link que leva direto à tela, sem barra dupla", () => {
    for (const c of TODAS) {
      const e = montarEmail(c, ctx({}, { fimFormatado: "03/11/2026", diasRestantes: 3, diasExtensao: 7 }));
      assert.ok(e.assunto.length > 5, c);
      assert.match(e.texto, /https:\/\/www\.exemplo\.com\.br\/[a-z]/, c);
      assert.doesNotMatch(e.texto, /br\/\//, c);
      assert.match(e.html, /<a href="https:\/\/www\.exemplo\.com\.br\/[a-z-/]+"/, c);
    }
  });

  it("e-mail promocional leva o link de descadastro; o transacional não", () => {
    const link = "https://www.exemplo.com.br/descadastrar/abc";
    for (const c of TODAS) {
      const e = montarEmail(c, ctx({}, { linkDescadastro: CATEGORIA_DA_CAMPANHA[c] === "promocional" ? link : undefined }));
      assert.equal(e.texto.includes(link), CATEGORIA_DA_CAMPANHA[c] === "promocional", c);
      assert.equal(e.html.includes(link), CATEGORIA_DA_CAMPANHA[c] === "promocional", c);
    }
  });

  it("escapa o nome no HTML (sem injeção)", () => {
    const e = montarEmail("boas_vindas", ctx({}, { nome: '<script>alert(1)</script> "x"' }));
    assert.doesNotMatch(e.html, /<script>/);
    assert.match(e.html, /&lt;script&gt;/);
  });

  it("o fim do teste diz a data, o que acontece depois e não promete o que não existe", () => {
    const e = montarEmail("fim_do_teste", ctx({}, { fimFormatado: "03/11/2026", diasRestantes: 3 }));
    assert.match(e.assunto, /3 dias/);
    assert.match(e.texto, /03\/11\/2026/);
    assert.match(e.texto, /somente para consulta/);
    assert.match(e.texto, /nada é apagado/);
    assert.doesNotMatch(e.texto, /R\$|desconto|garant/i, "sem preço nem promessa de resultado");
  });

  it("o dia do término diz 'hoje' e a véspera diz 'amanhã'", () => {
    assert.match(montarEmail("fim_do_teste", ctx({}, { diasRestantes: 0 })).assunto, /hoje/);
    assert.match(montarEmail("fim_do_teste", ctx({}, { diasRestantes: 1 })).assunto, /amanhã/);
  });

  it("a dica do problema muda conforme o que falta (estoque ou calendário)", () => {
    assert.match(montarEmail("problema", ctx({ produtos: 0 })).texto, /\/estoque/);
    assert.match(montarEmail("problema", ctx({ produtos: 2, compromissos: 0 })).texto, /\/calendario/);
  });

  it("para quem usa só a rede, a boas-vindas leva ao perfil e não fala de dias de teste", () => {
    const e = montarEmail("boas_vindas", ctx({ plano: "gratuito" }));
    assert.match(e.texto, /\/minha-rede\/perfil/);
    assert.doesNotMatch(e.assunto, /dias de teste/);
  });
});
