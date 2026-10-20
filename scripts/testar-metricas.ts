import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { calcularMetricas } from "../src/services/data/server/metricasCore.server";

// Teste de integração do painel de métricas contra o banco REAL. O banco tem dados verdadeiros, então nada aqui
// confere números absolutos: lê o painel, cria empresas descartáveis (nome com marcador aleatório) e confere a
// DIFERENÇA. Apaga SÓ o que criou.
//
// Rodar: yarn testar:metricas   (precisa de .env.local com DATABASE_URL)

const prisma = new PrismaClient();
const marca = `met-teste-${randomBytes(3).toString("hex")}`;
const iso = (d: Date = new Date()) => d.toISOString();
const diasAtras = (n: number) => new Date(Date.now() - n * 86_400_000);
const empresasIds: string[] = [];

const resultados: { nome: string; ok: boolean; erro?: string }[] = [];
async function teste(nome: string, corpo: () => Promise<void>): Promise<void> {
  try {
    await corpo();
    resultados.push({ nome, ok: true });
  } catch (e) {
    resultados.push({ nome, ok: false, erro: e instanceof Error ? (e.stack ?? e.message) : String(e) });
  }
}

async function criarEmpresa(
  sufixo: string,
  o: { plano?: "teste" | "ativo" | "gratuito"; fimDoTeste?: Date | null; criadoEm?: Date; convidadaPorId?: string } = {},
): Promise<string> {
  const plano = o.plano ?? "teste";
  const e = await prisma.empresa.create({
    data: {
      documento: `${marca}-${sufixo}`,
      razaoSocial: `${marca} ${sufixo}`,
      tipoPessoa: "pj",
      plano,
      testeTerminaEm: o.fimDoTeste === undefined ? null : o.fimDoTeste ? iso(o.fimDoTeste) : null,
      convidadaPorId: o.convidadaPorId,
      aceiteTermosVersao: "teste",
      aceiteTermosEm: iso(),
      criadoEm: iso(o.criadoEm),
      atualizadoEm: iso(),
    },
  });
  empresasIds.push(e.id);
  return e.id;
}

async function criarDono(empresaId: string, sufixo: string, confirmado: boolean): Promise<string> {
  const u = await prisma.usuario.create({
    data: {
      empresaId,
      nome: `Pessoa ${sufixo} ${marca}`,
      email: `${marca}-${sufixo}@example.test`,
      senhaHash: "sem-login",
      papel: "dono",
      emailConfirmadoEm: confirmado ? iso() : null,
      criadoEm: iso(),
      atualizadoEm: iso(),
    },
  });
  return u.id;
}

const testeIniciado = (empresaId: string) =>
  prisma.eventoProduto.create({ data: { tipo: "teste_iniciado", empresaId, chave: `${marca}:teste:${empresaId}`, criadoEm: iso() } });

async function main(): Promise<void> {
  const antes = await calcularMetricas(30);

  // Cenário: A ativada (tem projeto), com tour concluído, convidada por D; B parada, e-mail não confirmado;
  // C com teste vencido e plano ativo (convertida) e extensão; E com teste vencido, sem converter, sem extensão;
  // F com teste ainda em andamento; G criada há 60 dias (fora do período de 30).
  const d = await criarEmpresa("D");
  const a = await criarEmpresa("A", { convidadaPorId: d, fimDoTeste: new Date(Date.now() + 5 * 86_400_000) });
  const b = await criarEmpresa("B", { plano: "gratuito" });
  const c = await criarEmpresa("C", { plano: "ativo", fimDoTeste: null });
  const e = await criarEmpresa("E", { fimDoTeste: diasAtras(2) });
  const f = await criarEmpresa("F", { fimDoTeste: new Date(Date.now() + 9 * 86_400_000) });
  const g = await criarEmpresa("G", { criadoEm: diasAtras(60), plano: "gratuito" });

  const ua = await criarDono(a, "a", true);
  await criarDono(b, "b", false);
  await criarDono(c, "c", true);
  await criarDono(e, "e", true);
  await criarDono(f, "f", true);
  await criarDono(g, "g", true);
  await criarDono(d, "d", true);

  await prisma.obra.create({ data: { empresaId: a, nome: `Obra ${marca}`, cliente: "Cliente", status: "em_andamento", dataInicio: "2026-01-01", criadoEm: iso(), atualizadoEm: iso() } });
  await prisma.progressoOnboarding.create({ data: { usuarioId: ua, tourEstado: "concluido", tourPasso: 3, criadoEm: iso(), atualizadoEm: iso() } });
  for (const x of [a, c, e, f]) await testeIniciado(x);
  await prisma.extensaoTeste.create({
    data: { empresaId: c, dias: 7, motivo: "teste de métricas", concedidaPorId: "sistema", fimAnterior: iso(diasAtras(10)), fimNovo: iso(diasAtras(3)), criadoEm: iso(diasAtras(8)) },
  });
  await prisma.eventoProduto.create({ data: { tipo: "email_descadastro", empresaId: a, chave: `${marca}:desc`, criadoEm: iso() } });

  const depois = await calcularMetricas(30);
  const dif = <T extends number>(ler: (m: typeof depois) => T) => ler(depois) - ler(antes);

  await teste("1. cadastros do período contam as empresas novas e ignoram a criada há 60 dias", async () => {
    assert.equal(dif((m) => m.coorte.cadastros), 6, "D, A, B, C, E, F (G fica de fora)");
  });
  await teste("2. confirmação de e-mail conta só os donos que confirmaram", async () => {
    assert.equal(dif((m) => m.coorte.emailConfirmado), 5, "todos menos B");
  });
  await teste("3. ativação conta só quem fez algo de verdade (A tem projeto)", async () => {
    assert.equal(dif((m) => m.coorte.ativadas), 1);
  });
  await teste("4. indicação conta o cadastro que veio do convite (A)", async () => {
    assert.equal(dif((m) => m.coorte.porIndicacao), 1);
  });
  await teste("5. tour: um concluído; os demais donos entram como não iniciados", async () => {
    assert.equal(dif((m) => m.coorte.tour.concluido), 1);
    assert.equal(dif((m) => m.coorte.tour.naoIniciado), 5);
    assert.equal(dif((m) => m.coorte.tour.pulado), 0);
  });
  await teste("6. teste: iniciados, em andamento (A e F), amadurecidos (C e E) e convertido só C", async () => {
    assert.equal(dif((m) => m.teste.iniciados), 4);
    assert.equal(dif((m) => m.teste.emAndamento), 2);
    assert.equal(dif((m) => m.teste.amadurecidos), 2);
    assert.equal(dif((m) => m.teste.convertidos), 1);
  });
  await teste("7. extensão: C (com extensão, convertida) separada de E (sem extensão, não convertida)", async () => {
    assert.equal(dif((m) => m.teste.comExtensao.amadurecidos), 1);
    assert.equal(dif((m) => m.teste.comExtensao.convertidos), 1);
    assert.equal(dif((m) => m.teste.semExtensao.amadurecidos), 1);
    assert.equal(dif((m) => m.teste.semExtensao.convertidos), 0);
    assert.equal(dif((m) => m.teste.extensoes), 1);
    assert.equal(dif((m) => m.teste.diasEstendidos), 7);
  });
  await teste("8. descadastro do período é contado", async () => {
    assert.equal(dif((m) => m.emails.descadastros), 1);
  });
  await teste("9. o período de 7 dias não conta a empresa criada há 60 dias nem a de hoje a menos", async () => {
    const sete = await calcularMetricas(7);
    assert.ok(sete.coorte.cadastros >= 6, "as seis criadas hoje aparecem");
    assert.ok(sete.coorte.cadastros <= depois.coorte.cadastros);
  });
}

async function limpar(): Promise<void> {
  const empresas = await prisma.empresa.findMany({ where: { razaoSocial: { startsWith: marca } }, select: { id: true } });
  const ids = empresas.map((x) => x.id);
  if (ids.length === 0) return;
  const usuarios = await prisma.usuario.findMany({ where: { empresaId: { in: ids } }, select: { id: true } });
  const usuarioIds = usuarios.map((u) => u.id);
  await prisma.$transaction([
    prisma.eventoProduto.deleteMany({ where: { OR: [{ empresaId: { in: ids } }, { usuarioId: { in: usuarioIds } }, { chave: { startsWith: marca } }] } }),
    prisma.progressoOnboarding.deleteMany({ where: { usuarioId: { in: usuarioIds } } }),
    prisma.extensaoTeste.deleteMany({ where: { empresaId: { in: ids } } }),
    prisma.obra.deleteMany({ where: { empresaId: { in: ids } } }),
    prisma.usuario.deleteMany({ where: { empresaId: { in: ids } } }),
    prisma.empresa.deleteMany({ where: { id: { in: ids } } }),
  ]);
}

main()
  .catch((err) => {
    resultados.push({ nome: "preparação", ok: false, erro: err instanceof Error ? (err.stack ?? err.message) : String(err) });
  })
  .finally(async () => {
    await limpar().catch((err) => console.error("FALHA NA LIMPEZA — conferir empresas com o marcador", marca, err));
    const sobraram = await prisma.empresa.count({ where: { razaoSocial: { startsWith: marca } } }).catch(() => -1);
    const eventosSobrando = await prisma.eventoProduto.count({ where: { chave: { startsWith: marca } } }).catch(() => -1);
    await prisma.$disconnect();
    for (const r of resultados) console.log(`${r.ok ? "ok    " : "FALHOU"} ${r.nome}${r.erro ? `\n         ${r.erro}` : ""}`);
    const falhas = resultados.filter((r) => !r.ok).length;
    console.log(`\n${resultados.length - falhas}/${resultados.length} cenários passaram. Empresas de teste que sobraram: ${sobraram}; eventos que sobraram: ${eventosSobrando}.`);
    process.exit(falhas === 0 && sobraram === 0 && eventosSobrando === 0 ? 0 : 1);
  });
