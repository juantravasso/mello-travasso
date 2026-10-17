import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ACESSO,
  CHAVES_MODULO,
  ehModulo,
  modulosDisponiveis,
  moduloDaRota,
  normalizarModulos,
  podeAcessarRota,
  primeiraRotaPermitida,
  temAlgumModulo,
  TODOS_OS_MODULOS,
  type AcessoDaPessoa,
  type ModuloChave,
} from "./modulos";

const dono: AcessoDaPessoa = { papel: "dono", modulos: TODOS_OS_MODULOS };
const membro = (...modulos: ModuloChave[]): AcessoDaPessoa => ({ papel: "membro", modulos });
const GESTAO_E_REDE = new Set(["gestao", "rede"]);

describe("definição dos módulos", () => {
  it("as chaves são únicas e reconhecidas", () => {
    assert.equal(new Set(CHAVES_MODULO).size, CHAVES_MODULO.length);
    assert.ok(CHAVES_MODULO.every(ehModulo));
    assert.equal(ehModulo("inventado"), false);
    assert.equal(ehModulo(undefined), false);
  });
  it("normaliza: descarta o que não é módulo e as repetições, na ordem do menu", () => {
    assert.deepEqual(normalizarModulos(["estoque", "lixo", "dashboard", "estoque"]), ["dashboard", "estoque"]);
    assert.deepEqual(normalizarModulos([]), []);
  });
  it("toda lista de acesso só cita módulos que existem", () => {
    for (const [acao, lista] of Object.entries(ACESSO)) {
      for (const m of lista) assert.ok(ehModulo(m), `${acao} cita módulo inexistente: ${m}`);
    }
  });
  it("cada módulo tem uma rota própria e distinta", () => {
    assert.equal(moduloDaRota("/contas-a-pagar"), "contas_pagar");
    assert.equal(moduloDaRota("/contas-a-receber/abc"), "contas_receber");
  });
});

describe("regra de acesso por módulo", () => {
  it("o dono tem acesso a tudo, mesmo sem lista", () => {
    for (const lista of Object.values(ACESSO)) assert.equal(temAlgumModulo(dono, lista), true);
  });
  it("o membro só tem o que foi marcado", () => {
    const p = membro("estoque");
    assert.equal(temAlgumModulo(p, ACESSO.estoque), true);
    assert.equal(temAlgumModulo(p, ACESSO.calendario), false);
    assert.equal(temAlgumModulo(p, ACESSO.contasPagarEscrever), false);
  });
  it("membro sem nenhum módulo não acessa nada de gestão", () => {
    assert.equal(temAlgumModulo(membro(), ACESSO.obrasLer), false);
    assert.equal(temAlgumModulo(membro()), false);
  });
  it("sem lista, vale qualquer módulo de gestão, mas o Elo Profissionais sozinho não conta", () => {
    assert.equal(temAlgumModulo(membro("calendario")), true);
    assert.equal(temAlgumModulo(membro("rede")), false);
  });
  it("módulos de referência: quem lança conta enxerga projetos, mas não os altera", () => {
    const p = membro("contas_pagar");
    assert.equal(temAlgumModulo(p, ACESSO.obrasLer), true);
    assert.equal(temAlgumModulo(p, ACESSO.obrasEscrever), false);
    assert.equal(temAlgumModulo(p, ACESSO.fornecedoresCriar), true);
    assert.equal(temAlgumModulo(p, ACESSO.fornecedoresAlterar), false);
  });
  it("contas a pagar e a receber são separadas", () => {
    const soReceber = membro("contas_receber");
    assert.equal(temAlgumModulo(soReceber, ACESSO.contasReceberEscrever), true);
    assert.equal(temAlgumModulo(soReceber, ACESSO.contasPagarLer), false);
    const soPagar = membro("contas_pagar");
    assert.equal(temAlgumModulo(soPagar, ACESSO.contasReceberLer), false);
  });
  it("o dashboard lê as duas, mas não lança nenhuma", () => {
    const p = membro("dashboard");
    assert.equal(temAlgumModulo(p, ACESSO.contasPagarLer), true);
    assert.equal(temAlgumModulo(p, ACESSO.contasReceberLer), true);
    assert.equal(temAlgumModulo(p, ACESSO.contasPagarEscrever), false);
    assert.equal(temAlgumModulo(p, ACESSO.contasReceberEscrever), false);
  });
});

describe("rotas e módulos", () => {
  it("associa cada rota ao seu módulo", () => {
    assert.equal(moduloDaRota("/dashboard"), "dashboard");
    assert.equal(moduloDaRota("/obras/novo"), "projetos");
    assert.equal(moduloDaRota("/estoque/123"), "estoque");
    assert.equal(moduloDaRota("/custos-produtos"), "estoque");
    assert.equal(moduloDaRota("/minha-rede/perfil"), "rede");
    assert.equal(moduloDaRota("/calendario?evento=abc"), "calendario");
    assert.equal(moduloDaRota("/cadastro"), "cadastro");
  });
  it("rotas livres: configurações e o que não é módulo", () => {
    assert.equal(moduloDaRota("/configuracoes"), null);
    assert.equal(moduloDaRota("/admin/usuarios"), null);
  });
  it("prefixo não vaza para rota parecida (/obras não é /obrasX)", () => {
    assert.equal(moduloDaRota("/obrasX"), null);
  });
  it("membro só abre as rotas dos seus módulos", () => {
    const p = membro("estoque", "calendario");
    assert.equal(podeAcessarRota(p, "/estoque/novo"), true);
    assert.equal(podeAcessarRota(p, "/calendario"), true);
    assert.equal(podeAcessarRota(p, "/contas-a-pagar"), false);
    assert.equal(podeAcessarRota(p, "/minha-rede"), false);
    assert.equal(podeAcessarRota(p, "/configuracoes"), true);
  });
  it("Cadastro abre para quem tem projetos, funcionários ou fornecedores", () => {
    assert.equal(podeAcessarRota(membro("fornecedores"), "/cadastro"), true);
    assert.equal(podeAcessarRota(membro("estoque"), "/cadastro"), false);
    assert.equal(podeAcessarRota(dono, "/cadastro"), true);
  });
});

describe("primeira página permitida", () => {
  it("o dono começa pelo dashboard", () => assert.equal(primeiraRotaPermitida(dono, GESTAO_E_REDE), "/dashboard"));
  it("o membro começa pelo primeiro módulo que tem, na ordem do menu", () => {
    assert.equal(primeiraRotaPermitida(membro("estoque", "contas_pagar"), GESTAO_E_REDE), "/contas-a-pagar");
  });
  it("respeita o plano: sem gestão, vai para o Elo Profissionais", () => {
    assert.equal(primeiraRotaPermitida(dono, new Set(["rede"])), "/minha-rede");
  });
  it("sem nenhum módulo, cai em Configurações", () => assert.equal(primeiraRotaPermitida(membro(), GESTAO_E_REDE), "/configuracoes"));
});

describe("módulos que o plano permite liberar", () => {
  it("plano completo libera todos", () => assert.deepEqual(modulosDisponiveis(GESTAO_E_REDE), [...CHAVES_MODULO]));
  it("plano gratuito (só a rede) libera só o Elo Profissionais", () => assert.deepEqual(modulosDisponiveis(new Set(["rede"])), ["rede"]));
});
