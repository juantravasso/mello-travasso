import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import * as contas from "../src/services/data/server/contasCore.server";
import type { ContextoContas } from "../src/services/data/server/contasCore.server";
import type { NovaContaFinanceiraInput } from "../src/types";

// Teste de integração do núcleo de contas (o mesmo usado pelo site e pelo assistente do WhatsApp) contra o banco REAL.
// Cria duas empresas descartáveis (o nome leva um marcador aleatório), exercita as regras e apaga SÓ o que criou.
//
// Rodar: yarn testar:contas   (precisa de .env.local com DATABASE_URL; use o banco de demonstração)

const prisma = new PrismaClient();
const marca = `contas-teste-${randomBytes(3).toString("hex")}`;

const resultados: { nome: string; ok: boolean; erro?: string }[] = [];
async function teste(nome: string, corpo: () => Promise<void>): Promise<void> {
  try {
    await corpo();
    resultados.push({ nome, ok: true });
  } catch (e) {
    resultados.push({ nome, ok: false, erro: e instanceof Error ? (e.stack ?? e.message) : String(e) });
  }
}

async function rejeita(promessa: Promise<unknown>, trecho: RegExp): Promise<void> {
  await assert.rejects(promessa, (e: unknown) => e instanceof Error && trecho.test(e.message));
}

const iso = () => new Date().toISOString();
const hoje = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

async function criarEmpresa(sufixo: string): Promise<{ empresaId: string; obraId: string }> {
  const e = await prisma.empresa.create({
    data: {
      documento: `${marca}-${sufixo}`,
      razaoSocial: `${marca} ${sufixo}`,
      tipoPessoa: "pj",
      plano: "teste",
      testeTerminaEm: new Date(Date.now() + 20 * 86_400_000).toISOString(),
      aceiteTermosVersao: "teste",
      aceiteTermosEm: iso(),
      criadoEm: iso(),
      atualizadoEm: iso(),
    },
  });
  const o = await prisma.obra.create({ data: { empresaId: e.id, nome: "Casa Barra", cliente: "Cliente", status: "em_andamento", dataInicio: "2026-11-01", criadoEm: iso(), atualizadoEm: iso() } });
  return { empresaId: e.id, obraId: o.id };
}

function nova(obraId: string, extra: Partial<NovaContaFinanceiraInput> = {}): NovaContaFinanceiraInput {
  return {
    tipo: "pagar",
    obraId,
    valor: 150,
    dataLancamento: hoje(),
    dataVencimento: "2026-12-10",
    favorecidoOuCliente: "Provedor Internet",
    descricao: "Internet do escritório",
    comprovanteUrl: "",
    origemNotaFiscal: false,
    precisaCompletarCadastro: false,
    ...extra,
  };
}

async function main(): Promise<void> {
  const A = await criarEmpresa("A");
  const B = await criarEmpresa("B");
  const donoA: ContextoContas = { empresaId: A.empresaId, nome: "Dono A", papel: "dono", modulos: [] };
  const donoB: ContextoContas = { empresaId: B.empresaId, nome: "Dono B", papel: "dono", modulos: [] };
  const soPagarA: ContextoContas = { empresaId: A.empresaId, nome: "Membro A", papel: "membro", modulos: ["contas_pagar"] };

  await teste("1. cria conta e ela aparece na lista e na busca, com histórico de quem criou", async () => {
    const c = await contas.criarConta(donoA, nova(A.obraId));
    assert.equal(c.status, "em_aberto");
    assert.equal(c.historico[0].usuario, "Dono A");
    const achadas = await contas.listarContas(donoA, { busca: "internet" });
    assert.ok(achadas.some((x) => x.id === c.id));
  });

  await teste("2. isolamento: outra empresa não lê, não baixa, não cancela e não lança no projeto alheio", async () => {
    const c = await contas.criarConta(donoA, nova(A.obraId));
    assert.equal(await contas.obterContaPorId(donoB, c.id), null);
    assert.ok(!(await contas.listarContas(donoB)).some((x) => x.id === c.id));
    await rejeita(contas.baixarConta(donoB, { contaId: c.id, dataBaixa: hoje() }), /não encontrada/);
    await rejeita(contas.cancelarConta(donoB, { contaId: c.id }), /não encontrada/);
    await rejeita(contas.atualizarConta(donoB, c.id, { valor: 1 }), /não encontrada/);
    await rejeita(contas.criarConta(donoB, nova(A.obraId)), /Projeto não encontrado/);
    assert.equal((await contas.obterContaPorId(donoA, c.id))?.status, "em_aberto");
  });

  await teste("3. permissão por tipo: quem só tem contas a pagar não vê nem lança a receber", async () => {
    const r = await contas.criarConta(donoA, nova(A.obraId, { tipo: "receber", favorecidoOuCliente: "Cliente X", descricao: "Serviço" }));
    assert.equal(await contas.obterContaPorId(soPagarA, r.id), null);
    assert.ok((await contas.listarContas(soPagarA)).every((x) => x.tipo === "pagar"));
    await rejeita(contas.listarContas(soPagarA, { tipo: "receber" }), /SEM_ACESSO_MODULO/);
    await rejeita(contas.criarConta(soPagarA, nova(A.obraId, { tipo: "receber" })), /SEM_ACESSO_MODULO/);
    await rejeita(contas.baixarConta(soPagarA, { contaId: r.id, dataBaixa: hoje() }), /SEM_ACESSO_MODULO/);
    assert.ok(await contas.criarConta(soPagarA, nova(A.obraId)));
  });

  await teste("4. muda o vencimento; conta baixada não pode mais ser editada nem cancelada", async () => {
    const c = await contas.criarConta(donoA, nova(A.obraId));
    const editada = await contas.atualizarConta(donoA, c.id, { dataVencimento: "2026-12-12" });
    assert.equal(editada.dataVencimento, "2026-12-12");
    const baixada = await contas.baixarConta(donoA, { contaId: c.id, dataBaixa: hoje() });
    assert.equal(baixada.status, "baixada");
    assert.equal(baixada.historico.at(-1)?.tipo, "baixa");
    await rejeita(contas.atualizarConta(donoA, c.id, { valor: 10 }), /em aberto/);
    await rejeita(contas.cancelarConta(donoA, { contaId: c.id }), /em aberto/);
  });

  await teste("5. dois cancelamentos ao mesmo tempo: um só passa", async () => {
    const c = await contas.criarConta(donoA, nova(A.obraId));
    const r = await Promise.allSettled([contas.cancelarConta(donoA, { contaId: c.id, motivo: "duplicada" }), contas.cancelarConta(donoA, { contaId: c.id, motivo: "duplicada" })]);
    assert.equal(r.filter((x) => x.status === "fulfilled").length, 1);
    assert.equal((await contas.obterContaPorId(donoA, c.id))?.status, "cancelada");
  });

  await teste("6. baixa em lote ignora o que já não está em aberto e não toca outra empresa", async () => {
    const a1 = await contas.criarConta(donoA, nova(A.obraId));
    const a2 = await contas.criarConta(donoA, nova(A.obraId));
    await contas.baixarConta(donoA, { contaId: a2.id, dataBaixa: hoje() });
    const r = await contas.baixarContasEmLote(donoA, { contaIds: [a1.id, a2.id], dataBaixa: hoje() });
    assert.ok(r.ok && r.dados.baixadas === 1 && r.dados.ignoradas === 1, JSON.stringify(r));
    const b = await contas.criarConta(donoB, nova(B.obraId));
    const cruzado = await contas.baixarContasEmLote(donoA, { contaIds: [b.id], dataBaixa: hoje() });
    assert.equal(cruzado.ok, false);
    assert.equal((await contas.obterContaPorId(donoB, b.id))?.status, "em_aberto");
  });

  await teste("7. calendário mostra as contas em aberto do período (corrige o filtro de data quebrado)", async () => {
    const c = await contas.criarConta(donoA, nova(A.obraId, { dataVencimento: "2026-12-20" }));
    const itens = await contas.listarContasNoCalendario(donoA, "2026-12-01", "2026-12-31");
    assert.ok(itens.some((i) => i.id === `conta-${c.id}`), "conta em aberto aparece no calendário");
    assert.deepEqual(await contas.listarContasNoCalendario(donoA, "dez", "2026-12-31"), []);
    assert.ok(!(await contas.listarContasNoCalendario(donoB, "2026-12-01", "2026-12-31")).some((i) => i.id === `conta-${c.id}`));
  });

  await teste("8. dados inválidos não gravam", async () => {
    await rejeita(contas.criarConta(donoA, nova(A.obraId, { valor: -5 })), /inválidos/);
    await rejeita(contas.criarConta(donoA, { ...nova(A.obraId), empresaId: B.empresaId } as unknown as NovaContaFinanceiraInput), /inválidos/);
  });
}

async function limpar(): Promise<void> {
  const empresas = await prisma.empresa.findMany({ where: { razaoSocial: { startsWith: marca } }, select: { id: true } });
  const ids = empresas.map((e) => e.id);
  if (ids.length === 0) return;
  const porEmpresa = { empresaId: { in: ids } };
  await prisma.$transaction([
    prisma.rateioConta.deleteMany({ where: { contaFinanceira: porEmpresa } }),
    prisma.contaFinanceira.deleteMany({ where: porEmpresa }),
    prisma.obra.deleteMany({ where: porEmpresa }),
    prisma.empresa.deleteMany({ where: { id: { in: ids } } }),
  ]);
}

main()
  .catch((e) => {
    resultados.push({ nome: "preparação", ok: false, erro: e instanceof Error ? (e.stack ?? e.message) : String(e) });
  })
  .finally(async () => {
    await limpar().catch((e) => console.error("FALHA NA LIMPEZA — conferir empresas com o marcador", marca, e));
    await prisma.$disconnect();
    for (const r of resultados) console.log(`${r.ok ? "ok    " : "FALHOU"} ${r.nome}${r.erro ? `\n         ${r.erro}` : ""}`);
    const falhas = resultados.filter((r) => !r.ok).length;
    console.log(`\n${resultados.length - falhas}/${resultados.length} cenários passaram.`);
    process.exit(falhas === 0 ? 0 : 1);
  });
