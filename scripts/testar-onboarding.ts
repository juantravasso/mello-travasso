import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { CHAVES_MODULO, type ModuloChave } from "../src/lib/auth/modulos";
import {
  atualizarTour,
  definirChecklistOculto,
  estadoDoChecklist,
  estadoDoOnboarding,
  estadoDoTour,
  registrarAjudaVista,
  type ContextoOnboarding,
} from "../src/services/data/server/onboardingCore.server";

// Teste de integração do onboarding (tour, checklist de ativação, tutoriais) contra o banco REAL. Cria empresas
// descartáveis (o nome leva um marcador aleatório), exercita as regras e apaga SÓ o que criou.
//
// Rodar: yarn testar:onboarding   (precisa de .env.local com DATABASE_URL)

const prisma = new PrismaClient();
const marca = `onb-teste-${randomBytes(3).toString("hex")}`;
const COMPLETO = new Set(["gestao", "rede"]);
const SO_REDE = new Set(["rede"]);

const resultados: { nome: string; ok: boolean; erro?: string }[] = [];
async function teste(nome: string, corpo: () => Promise<void>): Promise<void> {
  try {
    await corpo();
    resultados.push({ nome, ok: true });
  } catch (e) {
    resultados.push({ nome, ok: false, erro: e instanceof Error ? (e.stack ?? e.message) : String(e) });
  }
}

const iso = (d: Date = new Date()) => d.toISOString();
const diasAtras = (n: number) => new Date(Date.now() - n * 86_400_000);
const empresasIds: string[] = [];

async function criarEmpresa(sufixo: string, plano: "teste" | "gratuito" = "teste"): Promise<string> {
  const e = await prisma.empresa.create({
    data: {
      documento: `${marca}-${sufixo}`,
      razaoSocial: `${marca} ${sufixo}`,
      tipoPessoa: "pj",
      plano,
      testeTerminaEm: plano === "teste" ? iso(new Date(Date.now() + 10 * 86_400_000)) : null,
      aceiteTermosVersao: "teste",
      aceiteTermosEm: iso(),
      criadoEm: iso(),
      atualizadoEm: iso(),
    },
  });
  empresasIds.push(e.id);
  return e.id;
}

async function criarUsuario(empresaId: string, sufixo: string, o: { criadoEm?: Date; papel?: "dono" | "membro" } = {}): Promise<string> {
  const u = await prisma.usuario.create({
    data: {
      empresaId,
      nome: `Pessoa ${sufixo} ${marca}`,
      email: `${marca}-${sufixo}@example.test`,
      senhaHash: "sem-login",
      papel: o.papel ?? "dono",
      emailConfirmadoEm: iso(),
      criadoEm: iso(o.criadoEm),
      atualizadoEm: iso(),
    },
  });
  return u.id;
}

const ctxDe = (usuarioId: string, empresaId: string, o: { papel?: "dono" | "membro"; modulos?: readonly ModuloChave[]; recursos?: ReadonlySet<string> } = {}): ContextoOnboarding => ({
  usuarioId,
  empresaId,
  papel: o.papel ?? "dono",
  modulos: o.modulos ?? CHAVES_MODULO,
  recursos: o.recursos ?? COMPLETO,
});

const eventos = (tipo: string, empresaId: string) => prisma.eventoProduto.count({ where: { tipo, empresaId } });
const linhasDeProgresso = (usuarioId: string) => prisma.progressoOnboarding.count({ where: { usuarioId } });
const ids = (l: { id: string }[]) => l.map((x) => x.id);

async function main(): Promise<void> {
  await teste("1. cadastro recente: o tour abre sozinho uma vez, o checklist começa vazio e ler não grava nada", async () => {
    const e = await criarEmpresa("A");
    const u = await criarUsuario(e, "a");
    const ctx = ctxDe(u, e);
    const estado = await estadoDoOnboarding(ctx);
    assert.equal(estado.tour.estado, "nao_iniciado");
    assert.equal(estado.tour.abrirAutomaticamente, true);
    assert.equal(estado.tour.passo, 0);
    assert.ok(estado.tour.passos.length >= 6);
    assert.equal(estado.checklist.feitos, 0);
    assert.equal(estado.checklist.total, 6);
    assert.equal(estado.checklist.proximoId, "dados_empresa");
    assert.equal(estado.checklist.oculto, false);
    assert.deepEqual(estado.ajudasVistas, []);
    assert.equal(await linhasDeProgresso(u), 0, "ler o estado não pode criar linha");
  });

  await teste("2. quem já usa o sistema há tempo não leva o tour automático (mas pode rever)", async () => {
    const e = await criarEmpresa("B");
    const u = await criarUsuario(e, "b", { criadoEm: diasAtras(60) });
    const { tour } = await estadoDoTour(ctxDe(u, e));
    assert.equal(tour.abrirAutomaticamente, false);
    assert.equal(tour.estado, "nao_iniciado");
  });

  await teste("3. o tour guarda onde a pessoa parou e retoma; os eventos de início e conclusão contam uma vez só", async () => {
    const e = await criarEmpresa("C");
    const u = await criarUsuario(e, "c");
    const ctx = ctxDe(u, e);
    await atualizarTour(ctx, { estado: "em_andamento", passo: 2 });
    await atualizarTour(ctx, { estado: "em_andamento", passo: 3 });
    let { tour } = await estadoDoTour(ctx);
    assert.equal(tour.estado, "em_andamento");
    assert.equal(tour.passo, 3);
    assert.equal(tour.abrirAutomaticamente, false, "quem já começou não é incomodado de novo");
    assert.equal(await eventos("onboarding_iniciado", e), 1);
    assert.equal(await eventos("onboarding_concluido", e), 0);
    await atualizarTour(ctx, { estado: "concluido", passo: tour.passos.length - 1 });
    await atualizarTour(ctx, { estado: "concluido", passo: tour.passos.length - 1 });
    ({ tour } = await estadoDoTour(ctx));
    assert.equal(tour.estado, "concluido");
    assert.equal(await eventos("onboarding_iniciado", e), 1);
    assert.equal(await eventos("onboarding_concluido", e), 1);
    // Rever o tour depois de concluído é permitido e não gera outro "concluído".
    await atualizarTour(ctx, { estado: "em_andamento", passo: 0 });
    await atualizarTour(ctx, { estado: "concluido", passo: tour.passos.length - 1 });
    assert.equal(await eventos("onboarding_concluido", e), 1);
  });

  await teste("4. pular o tour guarda 'pulado' e conta como iniciado, não como concluído", async () => {
    const e = await criarEmpresa("D");
    const u = await criarUsuario(e, "d");
    await atualizarTour(ctxDe(u, e), { estado: "pulado", passo: 1 });
    assert.equal((await estadoDoTour(ctxDe(u, e))).tour.estado, "pulado");
    assert.equal(await eventos("onboarding_iniciado", e), 1);
    assert.equal(await eventos("onboarding_concluido", e), 0);
  });

  await teste("5. entradas inválidas do tour são recusadas no servidor (estado, passo fora da lista do usuário)", async () => {
    const e = await criarEmpresa("E");
    const u = await criarUsuario(e, "e", { papel: "membro" });
    const ctx = ctxDe(u, e, { papel: "membro", modulos: [] });
    await assert.rejects(atualizarTour(ctx, { estado: "em_andamento", passo: 5 }), /Passo do tour inválido/);
    await assert.rejects(atualizarTour(ctx, { estado: "em_andamento", passo: -1 }), /Passo do tour inválido/);
    await assert.rejects(atualizarTour(ctx, { estado: "qualquer" as never, passo: 0 }), /Estado do tour inválido/);
    await assert.rejects(atualizarTour(ctx, { estado: "em_andamento", passo: 1.5 }), /Passo do tour inválido/);
    assert.equal(await linhasDeProgresso(u), 0, "entrada inválida não pode gravar");
    await atualizarTour(ctx, { estado: "em_andamento", passo: 1 });
  });

  await teste("6. o tour do funcionário só tem o que o dono liberou", async () => {
    const e = await criarEmpresa("F");
    const u = await criarUsuario(e, "f", { papel: "membro" });
    const { tour } = await estadoDoTour(ctxDe(u, e, { papel: "membro", modulos: ["estoque"] }));
    assert.deepEqual(ids(tour.passos), ["boas_vindas", "estoque", "ajuda"]);
  });

  await teste("7. ocultar o checklist é por pessoa e dá para voltar a mostrar", async () => {
    const e = await criarEmpresa("G");
    const u1 = await criarUsuario(e, "g1");
    const u2 = await criarUsuario(e, "g2");
    await definirChecklistOculto(ctxDe(u1, e), true);
    assert.equal((await estadoDoChecklist(ctxDe(u1, e))).oculto, true);
    assert.equal((await estadoDoChecklist(ctxDe(u2, e))).oculto, false, "a escolha de uma pessoa não vale para outra");
    await definirChecklistOculto(ctxDe(u1, e), false);
    assert.equal((await estadoDoChecklist(ctxDe(u1, e))).oculto, false);
  });

  await teste("8. tutorial visto: uma vez por pessoa, só de módulo que ela usa, e nunca aceita chave inventada", async () => {
    const e = await criarEmpresa("H");
    const u = await criarUsuario(e, "h", { papel: "membro" });
    const ctx = ctxDe(u, e, { papel: "membro", modulos: ["estoque"] });
    await registrarAjudaVista(ctx, "estoque");
    await registrarAjudaVista(ctx, "estoque");
    assert.deepEqual((await estadoDoTour(ctx)).ajudasVistas, ["estoque"]);
    assert.equal(await eventos("tutorial_visualizado", e), 1);
    await assert.rejects(registrarAjudaVista(ctx, "captura"), /não está disponível/);
    await assert.rejects(registrarAjudaVista(ctx, "inventada"), /não encontrado/);
    await assert.rejects(registrarAjudaVista(ctx, "__proto__"), /não encontrado/);
    const semGestao = ctxDe(u, e, { papel: "dono", recursos: SO_REDE });
    await assert.rejects(registrarAjudaVista(semGestao, "estoque"), /não está disponível/, "módulo de gestão num plano sem gestão");
    assert.deepEqual((await estadoDoTour(ctx)).ajudasVistas, ["estoque"], "tentativa recusada não grava");
  });

  await teste("9. o checklist só avança com fatos reais, e cada item gera um evento só", async () => {
    const e = await criarEmpresa("I");
    const u = await criarUsuario(e, "i");
    const ctx = ctxDe(u, e);
    assert.equal((await estadoDoChecklist(ctx)).feitos, 0);

    const obra = await prisma.obra.create({ data: { empresaId: e, nome: `Obra ${marca}`, cliente: "Cliente", status: "em_andamento", dataInicio: "2026-01-01", criadoEm: iso(), atualizadoEm: iso() } });
    let c = await estadoDoChecklist(ctx);
    assert.deepEqual(ids(c.itens.filter((i) => i.feito)), ["primeiro_projeto"]);
    assert.equal(c.proximoId, "dados_empresa");
    await estadoDoChecklist(ctx);
    assert.equal(await eventos("item_checklist_concluido", e), 1, "ler de novo não conta de novo");

    await prisma.contaFinanceira.create({
      data: { empresaId: e, tipo: "pagar", obraId: obra.id, valor: 10, dataLancamento: "2026-10-01", dataVencimento: "2026-10-30", favorecidoOuCliente: "Fornecedor", descricao: "Conta", comprovanteUrl: "data:image/png;base64,AAAA", criadoEm: iso(), atualizadoEm: iso() },
    });
    await prisma.empresa.update({ where: { id: e }, data: { telefone: "21999990000", cidade: "Duque de Caxias" } });
    c = await estadoDoChecklist(ctx);
    assert.deepEqual(ids(c.itens.filter((i) => i.feito)).sort(), ["dados_empresa", "primeira_conta", "primeiro_projeto"]);
    assert.equal(c.feitos, 3);
    assert.equal(c.proximoId, "primeiro_produto");
    assert.equal(await eventos("item_checklist_concluido", e), 3);
  });

  await teste("10. o checklist de uma empresa não enxerga os dados de outra", async () => {
    const e1 = await criarEmpresa("J1");
    const e2 = await criarEmpresa("J2");
    const u1 = await criarUsuario(e1, "j1");
    const u2 = await criarUsuario(e2, "j2");
    await prisma.obra.create({ data: { empresaId: e1, nome: `Obra ${marca}`, cliente: "Cliente", status: "em_andamento", dataInicio: "2026-01-01", criadoEm: iso(), atualizadoEm: iso() } });
    assert.equal((await estadoDoChecklist(ctxDe(u1, e1))).feitos, 1);
    assert.equal((await estadoDoChecklist(ctxDe(u2, e2))).feitos, 0);
    assert.equal(await eventos("item_checklist_concluido", e2), 0);
  });

  await teste("11. o checklist do funcionário só tem os módulos dele e nada de dono", async () => {
    const e = await criarEmpresa("K");
    const u = await criarUsuario(e, "k", { papel: "membro" });
    const c = await estadoDoChecklist(ctxDe(u, e, { papel: "membro", modulos: ["calendario"] }));
    assert.deepEqual(ids(c.itens), ["primeiro_compromisso"]);
  });

  await teste("12. empresa que só usa a rede: itens de rede e o convite para o Elo Gestão", async () => {
    const e = await criarEmpresa("L", "gratuito");
    const u = await criarUsuario(e, "l");
    const ctx = ctxDe(u, e, { recursos: SO_REDE });
    const c = await estadoDoChecklist(ctx);
    assert.deepEqual(ids(c.itens), ["dados_empresa", "perfil_publicado", "experimentar_gestao"]);
    assert.equal(c.feitos, 0);
    const { tour } = await estadoDoTour(ctx);
    assert.deepEqual(ids(tour.passos), ["boas_vindas", "rede", "conhecer_gestao", "ajuda"]);
  });

  await teste("13. o progresso de uma pessoa não vaza para outra da mesma empresa", async () => {
    const e = await criarEmpresa("M");
    const u1 = await criarUsuario(e, "m1");
    const u2 = await criarUsuario(e, "m2");
    await atualizarTour(ctxDe(u1, e), { estado: "concluido", passo: 0 });
    await registrarAjudaVista(ctxDe(u1, e), "estoque");
    const outro = await estadoDoTour(ctxDe(u2, e));
    assert.equal(outro.tour.estado, "nao_iniciado");
    assert.deepEqual(outro.ajudasVistas, []);
  });
}

async function limpar(): Promise<void> {
  const empresas = await prisma.empresa.findMany({ where: { razaoSocial: { startsWith: marca } }, select: { id: true } });
  const ids = empresas.map((e) => e.id);
  if (ids.length === 0) return;
  const usuarios = await prisma.usuario.findMany({ where: { empresaId: { in: ids } }, select: { id: true } });
  const usuarioIds = usuarios.map((u) => u.id);
  await prisma.$transaction([
    prisma.eventoProduto.deleteMany({ where: { OR: [{ empresaId: { in: ids } }, { usuarioId: { in: usuarioIds } }] } }),
    prisma.progressoOnboarding.deleteMany({ where: { usuarioId: { in: usuarioIds } } }),
    prisma.contaFinanceira.deleteMany({ where: { empresaId: { in: ids } } }),
    prisma.obra.deleteMany({ where: { empresaId: { in: ids } } }),
    prisma.usuario.deleteMany({ where: { empresaId: { in: ids } } }),
    prisma.empresa.deleteMany({ where: { id: { in: ids } } }),
  ]);
}

main()
  .catch((e) => {
    resultados.push({ nome: "preparação", ok: false, erro: e instanceof Error ? (e.stack ?? e.message) : String(e) });
  })
  .finally(async () => {
    await limpar().catch((e) => console.error("FALHA NA LIMPEZA — conferir empresas com o marcador", marca, e));
    const sobraram = await prisma.empresa.count({ where: { razaoSocial: { startsWith: marca } } }).catch(() => -1);
    const eventosSobrando = await prisma.eventoProduto.count({ where: { empresaId: { in: empresasIds } } }).catch(() => -1);
    await prisma.$disconnect();
    for (const r of resultados) console.log(`${r.ok ? "ok    " : "FALHOU"} ${r.nome}${r.erro ? `\n         ${r.erro}` : ""}`);
    const falhas = resultados.filter((r) => !r.ok).length;
    console.log(`\n${resultados.length - falhas}/${resultados.length} cenários passaram. Empresas de teste que sobraram: ${sobraram}; eventos que sobraram: ${eventosSobrando}.`);
    process.exit(falhas === 0 && sobraram === 0 && eventosSobrando === 0 ? 0 : 1);
  });
