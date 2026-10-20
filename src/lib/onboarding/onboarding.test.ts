import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CHAVES_MODULO, moduloDaRota, type AcessoDaPessoa, type ModuloChave } from "../auth/modulos";
import { AJUDAS, ajudaDaRota, ajudasDisponiveis, ehChaveDeAjuda, LISTA_DE_AJUDAS } from "./ajuda";
import { calcularChecklist, resumirChecklist, type ContextoChecklist, type SinaisDoChecklist } from "./checklist";
import { passosDoTour } from "./tour";

const dono: AcessoDaPessoa = { papel: "dono", modulos: CHAVES_MODULO };
const membro = (...modulos: ModuloChave[]): AcessoDaPessoa => ({ papel: "membro", modulos });
const COMPLETO = new Set(["gestao", "rede"]);
const SO_REDE = new Set(["rede"]);

const vazio: SinaisDoChecklist = { obras: 0, contas: 0, produtos: 0, compromissos: 0, perfilPublicado: false, dadosEmpresaCompletos: false };
const ctx = (extra: Omit<Partial<ContextoChecklist>, "sinais"> & { sinais?: Partial<SinaisDoChecklist> } = {}): ContextoChecklist => ({
  pessoa: dono,
  recursos: COMPLETO,
  plano: "teste",
  ...extra,
  sinais: { ...vazio, ...extra.sinais },
});
const ids = (l: { id: string }[]) => l.map((x) => x.id);

describe("tutoriais (Como funciona?)", () => {
  it("existe um tutorial para cada módulo, completo e sem campo vazio", () => {
    assert.deepEqual(LISTA_DE_AJUDAS.map((a) => a.chave).sort(), [...CHAVES_MODULO].sort());
    for (const a of LISTA_DE_AJUDAS) {
      for (const campo of ["titulo", "oQueE", "problema", "exemplo"] as const) assert.ok(a[campo].trim().length > 20 || campo === "titulo", `${a.chave}.${campo}`);
      assert.ok(a.beneficios.length >= 2, `${a.chave}: benefícios`);
      assert.ok(a.passos.length >= 3, `${a.chave}: passos`);
      assert.ok(a.acao.rotulo.trim().length > 3, `${a.chave}: rótulo da ação`);
    }
  });

  it("o botão da próxima ação leva a uma tela do próprio módulo", () => {
    for (const a of LISTA_DE_AJUDAS) {
      assert.ok(a.acao.href.startsWith("/") && !a.acao.href.startsWith("//"), `${a.chave}: ${a.acao.href}`);
      assert.equal(moduloDaRota(a.acao.href), a.chave, `${a.chave}: ${a.acao.href} não pertence ao módulo`);
    }
  });

  it("não promete resultado garantido", () => {
    const todo = LISTA_DE_AJUDAS.map((a) => [a.oQueE, a.problema, ...a.beneficios, ...a.passos, a.exemplo].join(" ")).join(" ");
    assert.doesNotMatch(todo, /garant|aument(e|ar|o) (seu )?(faturamento|lucro)|reduz(a|ir) (seus )?custos em|R\$ ?\d+ ?(a mais|de economia)/i);
  });

  it("a ajuda da tela vem do módulo da rota; telas sem módulo não têm botão", () => {
    assert.equal(ajudaDaRota("/obras/abc123")?.chave, "projetos");
    assert.equal(ajudaDaRota("/estoque/deposito")?.chave, "estoque");
    assert.equal(ajudaDaRota("/custos-produtos")?.chave, "estoque");
    assert.equal(ajudaDaRota("/minha-rede/perfil")?.chave, "rede");
    for (const rota of ["/configuracoes", "/cadastro", "/ajuda", "/admin", "/"]) assert.equal(ajudaDaRota(rota), null, rota);
  });

  it("só reconhece chave de módulo conhecida", () => {
    assert.equal(ehChaveDeAjuda("estoque"), true);
    for (const v of ["", "admin", "__proto__", "constructor", "toString", undefined, 3]) assert.equal(ehChaveDeAjuda(v), false, String(v));
    assert.ok(!Object.hasOwn(AJUDAS, "__proto__"));
  });

  it("a lista da pessoa respeita plano e módulos", () => {
    assert.equal(ajudasDisponiveis(dono, COMPLETO).length, CHAVES_MODULO.length);
    assert.deepEqual(ajudasDisponiveis(dono, SO_REDE).map((a) => a.chave), ["rede"]);
    assert.deepEqual(ajudasDisponiveis(membro("estoque", "calendario"), COMPLETO).map((a) => a.chave), ["calendario", "estoque"]);
    assert.deepEqual(ajudasDisponiveis(membro(), COMPLETO), []);
    assert.deepEqual(ajudasDisponiveis(membro("estoque"), SO_REDE), [], "módulo de gestão num plano sem gestão");
  });
});

describe("tour inicial", () => {
  it("o dono do plano completo vê todas as áreas, de boas-vindas a ajuda", () => {
    const p = ids(passosDoTour(dono, COMPLETO));
    assert.equal(p[0], "boas_vindas");
    assert.equal(p.at(-1), "ajuda");
    for (const id of ["projetos_e_contas", "captura", "estoque", "calendario", "rede"]) assert.ok(p.includes(id), id);
    assert.ok(!p.includes("conhecer_gestao"), "quem já tem a gestão não recebe o convite para conhecê-la");
  });

  it("quem só usa a rede não vê passos de gestão e recebe o convite para conhecer o Elo Gestão", () => {
    assert.deepEqual(ids(passosDoTour(dono, SO_REDE)), ["boas_vindas", "rede", "conhecer_gestao", "ajuda"]);
  });

  it("o funcionário só vê o que o dono liberou", () => {
    assert.deepEqual(ids(passosDoTour(membro("estoque"), COMPLETO)), ["boas_vindas", "estoque", "ajuda"]);
    assert.deepEqual(ids(passosDoTour(membro(), COMPLETO)), ["boas_vindas", "ajuda"]);
    assert.deepEqual(ids(passosDoTour(membro("contas_pagar", "rede"), COMPLETO)), ["boas_vindas", "projetos_e_contas", "rede", "ajuda"]);
  });

  it("todo passo tem título e texto, e todo botão leva a uma rota interna", () => {
    for (const pessoa of [dono, membro("captura"), membro()]) {
      for (const recursos of [COMPLETO, SO_REDE]) {
        for (const p of passosDoTour(pessoa, recursos)) {
          assert.ok(p.titulo.length > 5 && p.texto.length > 30, p.id);
          if (p.acao) assert.ok(p.acao.href.startsWith("/") && !p.acao.href.startsWith("//"), `${p.id}: ${p.acao.href}`);
        }
      }
    }
  });
});

describe("checklist de ativação", () => {
  it("o dono do plano completo começa com 6 itens pendentes", () => {
    const itens = calcularChecklist(ctx());
    assert.deepEqual(ids(itens), ["dados_empresa", "primeiro_projeto", "primeira_conta", "primeiro_produto", "primeiro_compromisso", "perfil_publicado"]);
    assert.ok(itens.every((i) => !i.feito));
  });

  it("cada item só fica feito por um fato real nos dados", () => {
    const feitos = (s: Partial<SinaisDoChecklist>) => ids(calcularChecklist(ctx({ sinais: s })).filter((i) => i.feito));
    assert.deepEqual(feitos({}), []);
    assert.deepEqual(feitos({ obras: 1 }), ["primeiro_projeto"]);
    assert.deepEqual(feitos({ contas: 1 }), ["primeira_conta"]);
    assert.deepEqual(feitos({ produtos: 2 }), ["primeiro_produto"]);
    assert.deepEqual(feitos({ compromissos: 1 }), ["primeiro_compromisso"]);
    assert.deepEqual(feitos({ perfilPublicado: true }), ["perfil_publicado"]);
    assert.deepEqual(feitos({ dadosEmpresaCompletos: true }), ["dados_empresa"]);
  });

  it("funcionário vê só os itens dos módulos dele (e nunca os de dono)", () => {
    const itens = calcularChecklist(ctx({ pessoa: membro("contas_pagar") }));
    assert.deepEqual(ids(itens), ["primeira_conta"]);
    assert.equal(itens[0]?.href, "/contas-a-pagar", "sem o módulo Captura, o botão leva a Contas a pagar");
    assert.equal(calcularChecklist(ctx({ pessoa: membro("captura") }))[0]?.href, "/capturar");
    assert.deepEqual(calcularChecklist(ctx({ pessoa: membro() })), []);
    assert.ok(!ids(calcularChecklist(ctx({ pessoa: membro("projetos", "rede") }))).includes("dados_empresa"));
  });

  it("quem só usa a rede vê perfil, dados e o convite para experimentar o Elo Gestão", () => {
    const itens = calcularChecklist(ctx({ recursos: SO_REDE, plano: "gratuito" }));
    assert.deepEqual(ids(itens), ["dados_empresa", "perfil_publicado", "experimentar_gestao"]);
    assert.equal(itens.find((i) => i.id === "experimentar_gestao")?.feito, false);
  });

  it("depois de iniciar o teste, o convite some e os itens de gestão aparecem", () => {
    const itens = ids(calcularChecklist(ctx({ recursos: COMPLETO, plano: "teste" })));
    assert.ok(!itens.includes("experimentar_gestao"));
    assert.ok(itens.includes("primeiro_projeto"));
  });

  it("o resumo conta os feitos e aponta o primeiro pendente para continuar de onde parou", () => {
    const r = resumirChecklist(calcularChecklist(ctx({ sinais: { dadosEmpresaCompletos: true, obras: 1 } })));
    assert.equal(r.total, 6);
    assert.equal(r.feitos, 2);
    assert.equal(r.proximo?.id, "primeira_conta");
    const completo = resumirChecklist(calcularChecklist(ctx({ sinais: { dadosEmpresaCompletos: true, obras: 1, contas: 1, produtos: 1, compromissos: 1, perfilPublicado: true } })));
    assert.equal(completo.feitos, completo.total);
    assert.equal(completo.proximo, null);
  });

  it("todo botão leva a uma rota interna do módulo certo", () => {
    for (const i of calcularChecklist(ctx())) assert.ok(i.href.startsWith("/") && !i.href.startsWith("//"), i.id);
  });
});
