import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { registrarCaptura } from "../src/services/data/server/capturaCore.server";
import {
  custosTransferidosPorProjeto,
  garantirDeposito,
  historicoDeTransferencias,
  transferir,
  visaoDoDeposito,
} from "../src/services/data/server/depositoCore.server";
import type { EntradaCaptura } from "../src/types";

// Teste de integração do Depósito (captura com rateio, transferência, devolução, custo) contra o banco REAL. Cria duas
// empresas descartáveis (o nome leva um marcador aleatório), exercita as regras e apaga SÓ o que criou.
//
// Rodar: yarn testar:deposito   (precisa de .env.local com DATABASE_URL)

const prisma = new PrismaClient();
const marca = `dep-teste-${randomBytes(3).toString("hex")}`;

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
async function criarEmpresa(sufixo: string): Promise<string> {
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
  return e.id;
}
async function criarProjeto(empresaId: string, nome: string): Promise<string> {
  const o = await prisma.obra.create({
    data: { empresaId, nome: `${nome} ${marca}`, cliente: "Cliente", status: "em_andamento", dataInicio: "2026-01-01", criadoEm: iso(), atualizadoEm: iso() },
  });
  return o.id;
}

const COMPROVANTE = "data:image/png;base64,AAAA";
const nota = (obraId: string, extra: Partial<EntradaCaptura> = {}): EntradaCaptura => ({
  tipoDocumento: "nota_fiscal",
  obraId,
  valor: 100,
  data: "2026-03-10",
  favorecido: "Fornecedor Teste",
  descricao: "Compra de teste",
  comprovanteUrl: COMPROVANTE,
  itens: [],
  ...extra,
});
const item = (obraId: string, descricao: string, quantidade: number, valorUnitario: number) => ({
  descricao,
  quantidade,
  unidade: "un",
  valorUnitario,
  valorTotal: Math.round(quantidade * valorUnitario * 100) / 100,
  obraId,
});

const saldo = async (produtoNome: string, obraId: string) => {
  const p = await prisma.produto.findFirstOrThrow({ where: { nome: produtoNome, empresa: { razaoSocial: { startsWith: marca } } } });
  const s = await prisma.saldoEstoque.findUnique({ where: { produtoId_obraId: { produtoId: p.id, obraId } } });
  return s?.quantidade ?? 0;
};
const idProduto = async (empresaId: string, nome: string) => (await prisma.produto.findFirstOrThrow({ where: { empresaId, nome } })).id;
const somaRateios = (r: { valor: number }[]) => Math.round(r.reduce((s, x) => s + x.valor, 0) * 100) / 100;

async function main() {
  const empA = await criarEmpresa("A");
  const empB = await criarEmpresa("B");
  const a1 = await criarProjeto(empA, "Casa 1");
  const a2 = await criarProjeto(empA, "Casa 2");
  const b1 = await criarProjeto(empB, "Outra empresa");
  const ctxA = { empresaId: empA, nome: "Ana" };
  const ctxB = { empresaId: empB, nome: "Beto" };
  let deposito = "";

  await teste("1. o Depósito nasce uma vez só por empresa", async () => {
    deposito = await garantirDeposito(empA);
    assert.equal(await garantirDeposito(empA), deposito);
    const [x, y] = await Promise.all([garantirDeposito(empB), garantirDeposito(empB)]);
    assert.equal(x, y);
    assert.equal(await prisma.obra.count({ where: { empresaId: empA, ehDeposito: true } }), 1);
    assert.equal(await prisma.obra.count({ where: { empresaId: empB, ehDeposito: true } }), 1);
  });

  await teste("2. nota com todos os itens no mesmo projeto: conta única, sem rateio, estoque no projeto", async () => {
    const r = await registrarCaptura(ctxA, nota(a1, { valor: 100, itens: [item(a1, "Cimento CP2", 10, 6), item(a1, "Areia", 4, 10)] }));
    assert.equal(r.contasCriadas, 1);
    assert.equal(r.itensCriados, 2);
    assert.equal(r.rateios, undefined);
    const conta = await prisma.contaFinanceira.findUniqueOrThrow({ where: { id: r.contaId }, include: { rateios: true } });
    assert.equal(conta.obraId, a1);
    assert.equal(conta.rateios.length, 0);
    assert.equal(conta.status, "em_aberto");
    assert.equal(await saldo("Cimento CP2", a1), 10);
    assert.equal(await saldo("Areia", a1), 4);
  });

  await teste("3. nota dividida entre dois projetos: rateio proporcional (frete incluso) fecha no valor da nota", async () => {
    const r = await registrarCaptura(ctxA, nota(a1, { valor: 440, itens: [item(a1, "Tijolo", 300, 1), item(a2, "Telha", 100, 1)] }));
    assert.deepEqual(r.rateios, [
      { obraId: a1, valor: 330 },
      { obraId: a2, valor: 110 },
    ]);
    const conta = await prisma.contaFinanceira.findUniqueOrThrow({ where: { id: r.contaId }, include: { rateios: true } });
    assert.equal(conta.obraId, a1, "o projeto com a maior parte vira o projeto da conta");
    assert.equal(somaRateios(conta.rateios), 440);
    assert.equal(await saldo("Tijolo", a1), 300);
    assert.equal(await saldo("Telha", a2), 100);
    assert.equal(await saldo("Telha", a1), 0);
  });

  await teste("4. item para o Depósito: entra no estoque do Depósito e vira rateio, sem virar gasto de projeto", async () => {
    const r = await registrarCaptura(ctxA, nota(a1, { valor: 1000, itens: [item(a1, "Furadeira", 1, 200), item(deposito, "Brita", 40, 20)] }));
    const conta = await prisma.contaFinanceira.findUniqueOrThrow({ where: { id: r.contaId }, include: { rateios: true } });
    assert.equal(somaRateios(conta.rateios), 1000);
    const noDeposito = conta.rateios.find((x) => x.obraId === deposito);
    const noProjeto = conta.rateios.find((x) => x.obraId === a1);
    assert.equal(noDeposito?.valor, 800);
    assert.equal(noProjeto?.valor, 200);
    assert.equal(await saldo("Brita", deposito), 40);
    assert.equal(await saldo("Furadeira", a1), 1);
  });

  await teste("5. tudo para o Depósito: a conta fica no Depósito, sem rateio", async () => {
    const r = await registrarCaptura(ctxA, nota(deposito, { valor: 90, itens: [item(deposito, "Areia", 6, 15)] }));
    const conta = await prisma.contaFinanceira.findUniqueOrThrow({ where: { id: r.contaId }, include: { rateios: true } });
    assert.equal(conta.obraId, deposito);
    assert.equal(conta.rateios.length, 0);
    assert.equal(await saldo("Areia", deposito), 6);
  });

  await teste("6. parcelada com rateio: cada parcela fecha no seu valor e os itens ficam na 1ª conta", async () => {
    const r = await registrarCaptura(
      ctxA,
      nota(a1, {
        valor: 100,
        itens: [item(a1, "Porcelanato", 7, 10), item(a2, "Rejunte", 3, 10)],
        parcelas: [
          { valor: 33.33, dataVencimento: "2026-04-10" },
          { valor: 33.33, dataVencimento: "2026-05-10" },
          { valor: 33.34, dataVencimento: "2026-06-10" },
        ],
      }),
    );
    assert.equal(r.contasCriadas, 3);
    const contas = await prisma.contaFinanceira.findMany({ where: { parcelamentoId: { not: null }, descricao: { startsWith: "Compra de teste (parcela" }, empresaId: empA }, include: { rateios: true, itensProduto: true }, orderBy: { parcelaNumero: "asc" } });
    assert.equal(contas.length, 3);
    for (const c of contas) assert.equal(somaRateios(c.rateios), c.valor);
    assert.equal(contas[0]?.itensProduto.length, 2);
    assert.equal(contas[1]?.itensProduto.length, 0);
    assert.equal(somaRateios(contas.flatMap((c) => c.rateios.filter((x) => x.obraId === a1))), 70);
    assert.equal(somaRateios(contas.flatMap((c) => c.rateios.filter((x) => x.obraId === a2))), 30);
  });

  await teste("7. entradas inválidas são recusadas e nada fica gravado", async () => {
    const antes = await prisma.contaFinanceira.count({ where: { empresaId: empA } });
    const movAntes = await prisma.movimentoEstoque.count({ where: { empresaId: empA } });
    await rejeita(registrarCaptura(ctxA, nota(a1, { valor: 100, parcelas: [{ valor: 40, dataVencimento: "2026-04-10" }, { valor: 40, dataVencimento: "2026-05-10" }] })), /soma das parcelas/);
    await rejeita(registrarCaptura(ctxA, nota(a1, { itens: [item(b1, "Roubo", 1, 1)] })), /Projeto não encontrado/);
    await rejeita(registrarCaptura(ctxA, nota(b1)), /Projeto não encontrado/);
    await rejeita(registrarCaptura(ctxA, nota(deposito, { tipoDocumento: "comprovante" })), /precisa de um projeto/);
    await rejeita(registrarCaptura(ctxA, nota(a1, { tipoDocumento: "comprovante", itens: [item(a1, "X", 1, 1)] })), /Itens só valem para nota fiscal/);
    await rejeita(registrarCaptura(ctxA, nota(a1, { itens: [item(a1, "Zero", 0, 1)] })), /quantidade/);
    await rejeita(registrarCaptura(ctxA, { ...nota(a1), empresaId: empB } as unknown as EntradaCaptura), /./);
    await rejeita(registrarCaptura(ctxA, nota(a1, { fornecedorId: "00000000-0000-4000-8000-000000000000" })), /Fornecedor não encontrado/);
    assert.equal(await prisma.contaFinanceira.count({ where: { empresaId: empA } }), antes);
    assert.equal(await prisma.movimentoEstoque.count({ where: { empresaId: empA } }), movAntes);
  });

  await teste("8. comprovante simples: uma conta no projeto, sem itens nem estoque", async () => {
    const movAntes = await prisma.movimentoEstoque.count({ where: { empresaId: empA } });
    const r = await registrarCaptura(ctxA, nota(a2, { tipoDocumento: "comprovante", valor: 55.5 }));
    assert.equal(r.itensCriados, 0);
    const conta = await prisma.contaFinanceira.findUniqueOrThrow({ where: { id: r.contaId } });
    assert.equal(conta.obraId, a2);
    assert.equal(conta.origemNotaFiscal, false);
    assert.equal(await prisma.movimentoEstoque.count({ where: { empresaId: empA } }), movAntes);
  });

  await teste("9. visão do Depósito: quantidade, última compra, valor em estoque e onde mais está", async () => {
    const v = await visaoDoDeposito(empA);
    const brita = v.produtos.find((p) => p.nome === "Brita");
    assert.equal(brita?.quantidade, 40);
    assert.equal(brita?.ultimaCompra?.valorUnitario, 20);
    assert.equal(brita?.origemDoValor, "ultima_compra");
    assert.equal(brita?.valorEmEstoque, 800);
    const areia = v.produtos.find((p) => p.nome === "Areia");
    assert.equal(areia?.quantidade, 6);
    assert.deepEqual(areia?.nosProjetos, [{ obraId: a1, quantidade: 4 }], "a Areia também está no projeto 1");
    assert.equal(v.valorTotalEmEstoque, 800 + 90);
    assert.equal(v.depositoId, deposito);
  });

  await teste("10. transferir do Depósito ao valor da última compra vira gasto do projeto", async () => {
    const produtoId = await idProduto(empA, "Brita");
    const custoMedioAntes = (await prisma.produto.findUniqueOrThrow({ where: { id: produtoId } })).custoMedio;
    const t = await transferir(ctxA, { produtoId, obraId: a2, quantidade: 15 });
    assert.equal(t.sentido, "para_projeto");
    assert.equal(t.valorUnitario, 20);
    assert.equal(t.custo, 300);
    assert.equal(await saldo("Brita", deposito), 25);
    assert.equal(await saldo("Brita", a2), 15);
    assert.equal((await prisma.produto.findUniqueOrThrow({ where: { id: produtoId } })).custoMedio, custoMedioAntes, "transferir não é compra");
    const movs = await prisma.movimentoEstoque.findMany({ where: { transferenciaId: t.id } });
    assert.equal(movs.length, 2);
    assert.deepEqual(movs.map((m) => m.tipo).sort(), ["entrada", "saida"]);
    assert.equal((await custosTransferidosPorProjeto(empA))[a2], 300);
    assert.equal(await prisma.contaFinanceira.count({ where: { empresaId: empA, valor: 300 } }), 0, "não cria conta nem mexe no caixa");
  });

  await teste("11. transferência recusada (saldo, destino, produto de outra empresa, quantidade) não muda nada", async () => {
    const produtoId = await idProduto(empA, "Brita");
    const antes = JSON.stringify([await saldo("Brita", deposito), await saldo("Brita", a1), await custosTransferidosPorProjeto(empA)]);
    await rejeita(transferir(ctxA, { produtoId, obraId: a1, quantidade: 26 }), /Saldo insuficiente no Depósito: há 25/);
    await rejeita(transferir(ctxA, { produtoId, obraId: deposito, quantidade: 1 }), /Escolha um projeto/);
    await rejeita(transferir(ctxA, { produtoId, obraId: b1, quantidade: 1 }), /Projeto não encontrado/);
    await rejeita(transferir(ctxA, { produtoId, obraId: a1, quantidade: 0 }), /maior que zero/);
    await rejeita(transferir(ctxA, { produtoId, obraId: a1, quantidade: -3 }), /maior que zero/);
    await rejeita(transferir(ctxB, { produtoId, obraId: b1, quantidade: 1 }), /Produto não encontrado/);
    const depois = JSON.stringify([await saldo("Brita", deposito), await saldo("Brita", a1), await custosTransferidosPorProjeto(empA)]);
    assert.equal(depois, antes);
  });

  await teste("12. devolver ao Depósito abate o gasto do projeto; não dá para devolver mais do que o projeto tem", async () => {
    const produtoId = await idProduto(empA, "Brita");
    const t = await transferir(ctxA, { produtoId, obraId: a2, quantidade: 5, sentido: "devolucao" });
    assert.equal(t.sentido, "devolucao");
    assert.equal(t.custo, 100);
    assert.equal(await saldo("Brita", deposito), 30);
    assert.equal(await saldo("Brita", a2), 10);
    assert.equal((await custosTransferidosPorProjeto(empA))[a2], 200);
    await rejeita(transferir(ctxA, { produtoId, obraId: a2, quantidade: 11, sentido: "devolucao" }), /Saldo insuficiente no projeto: há 10/);
    const historico = await historicoDeTransferencias(empA, { obraId: a2 });
    assert.equal(historico.length, 2);
    assert.deepEqual(historico.map((h) => h.sentido).sort(), ["devolucao", "para_projeto"]);
  });

  await teste("13. o valor transferido acompanha a última compra (e ignora conta cancelada)", async () => {
    const produtoId = await idProduto(empA, "Brita");
    const nova = await registrarCaptura(ctxA, nota(deposito, { valor: 250, data: "2026-04-01", itens: [item(deposito, "Brita", 10, 25)] }));
    const t1 = await transferir(ctxA, { produtoId, obraId: a1, quantidade: 2 });
    assert.equal(t1.valorUnitario, 25, "usa a compra mais recente");
    await prisma.contaFinanceira.update({ where: { id: nova.contaId }, data: { status: "cancelada" } });
    const t2 = await transferir(ctxA, { produtoId, obraId: a1, quantidade: 2 });
    assert.equal(t2.valorUnitario, 20, "cancelada a última, volta à anterior");
    assert.equal((await custosTransferidosPorProjeto(empA))[a1], 2 * 25 + 2 * 20);
  });

  await teste("14. produto sem compra nem custo médio: transfere a R$ 0,00 e a visão avisa", async () => {
    const p = await prisma.produto.create({ data: { empresaId: empA, nome: "Doação", criadoEm: iso(), atualizadoEm: iso() } });
    await prisma.saldoEstoque.create({ data: { empresaId: empA, produtoId: p.id, obraId: deposito, quantidade: 5, atualizadoEm: iso() } });
    const v = await visaoDoDeposito(empA);
    const linha = v.produtos.find((x) => x.produtoId === p.id);
    assert.equal(linha?.origemDoValor, "sem_valor");
    assert.ok(v.semValor >= 1);
    const t = await transferir(ctxA, { produtoId: p.id, obraId: a1, quantidade: 2 });
    assert.equal(t.valorUnitario, 0);
    assert.equal(t.custo, 0);
  });

  await teste("15. isolamento: a empresa B não vê o Depósito, os produtos nem os custos da A", async () => {
    const v = await visaoDoDeposito(empB);
    assert.equal(v.produtos.length, 0);
    assert.notEqual(v.depositoId, deposito);
    assert.deepEqual(await custosTransferidosPorProjeto(empB), {});
    assert.deepEqual(await historicoDeTransferencias(empB), []);
  });

  await teste("16. transferências simultâneas não passam do saldo", async () => {
    const produtoId = await idProduto(empA, "Brita");
    const disponivel = await saldo("Brita", deposito);
    const resultado = await Promise.allSettled(Array.from({ length: 6 }, () => transferir(ctxA, { produtoId, obraId: a1, quantidade: Math.ceil(disponivel / 2) })));
    const feitas = resultado.filter((r) => r.status === "fulfilled").length;
    assert.equal(feitas, 2, "só duas metades cabem no saldo");
    assert.ok((await saldo("Brita", deposito)) >= 0);
  });
}

async function limpar(): Promise<void> {
  const empresas = await prisma.empresa.findMany({ where: { razaoSocial: { startsWith: marca } }, select: { id: true } });
  const ids = empresas.map((e) => e.id);
  if (ids.length === 0) return;
  const porEmpresa = { empresaId: { in: ids } };
  await prisma.$transaction([
    prisma.movimentoEstoque.deleteMany({ where: porEmpresa }),
    prisma.saldoEstoque.deleteMany({ where: porEmpresa }),
    prisma.itemProduto.deleteMany({ where: porEmpresa }),
    prisma.rateioConta.deleteMany({ where: { contaFinanceira: porEmpresa } }),
    prisma.contaFinanceira.deleteMany({ where: porEmpresa }),
    prisma.produto.deleteMany({ where: porEmpresa }),
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
