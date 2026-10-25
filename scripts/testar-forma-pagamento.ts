import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { registrarCaptura } from "../src/services/data/server/capturaCore.server";

// Teste de integração da configuração das formas de pagamento na captura (baixa automática e dia de vencimento) contra o
// banco REAL. Cria uma empresa descartável (marcador aleatório) e apaga SÓ o que criou.
//
// Rodar: yarn testar:forma-pagamento   (precisa de .env.local com DATABASE_URL)

const prisma = new PrismaClient();
const marca = `fp-teste-${randomBytes(3).toString("hex")}`;
const iso = () => new Date().toISOString();
const resultados: { nome: string; ok: boolean; erro?: string }[] = [];
async function teste(nome: string, corpo: () => Promise<void>): Promise<void> {
  try {
    await corpo();
    resultados.push({ nome, ok: true });
  } catch (e) {
    resultados.push({ nome, ok: false, erro: e instanceof Error ? (e.stack ?? e.message) : String(e) });
  }
}

async function main(): Promise<void> {
  const empresa = await prisma.empresa.create({
    data: { documento: marca, razaoSocial: `${marca} Empresa`, tipoPessoa: "pj", plano: "ativo", aceiteTermosVersao: "teste", aceiteTermosEm: iso(), criadoEm: iso(), atualizadoEm: iso() },
  });
  const obra = await prisma.obra.create({
    data: { empresaId: empresa.id, nome: `${marca} Projeto`, cliente: "Cliente", status: "em_andamento", dataInicio: "2026-10-01", criadoEm: iso(), atualizadoEm: iso() },
  });
  const ctx = { empresaId: empresa.id, nome: "Teste" };
  const captura = (extra: Record<string, unknown>) =>
    registrarCaptura(ctx, {
      tipoDocumento: "comprovante",
      obraId: obra.id,
      valor: 100,
      data: "2026-10-03",
      favorecido: "Favorecido",
      descricao: "Compra de teste",
      comprovanteUrl: "",
      itens: [],
      ...extra,
    });
  const conta = (id: string) => prisma.contaFinanceira.findUniqueOrThrow({ where: { id } });

  await teste("1. PIX com cadastro completo já nasce baixado e sem pendência", async () => {
    const r = await captura({ categoria: "aluguel", formaPagamento: "pix" });
    const c = await conta(r.contaId);
    assert.equal(c.status, "baixada");
    assert.equal(c.dataBaixa, "2026-10-03");
    assert.equal(c.precisaCompletarCadastro, false);
    assert.ok((c.historico as { tipo: string }[]).some((e) => e.tipo === "baixa"));
  });

  await teste("2. PIX sem categoria continua em aberto, a completar", async () => {
    const c = await conta((await captura({ formaPagamento: "pix" })).contaId);
    assert.equal(c.status, "em_aberto");
    assert.equal(c.precisaCompletarCadastro, true);
  });

  await teste("3. boleto e cartão de crédito não baixam sozinhos (pagam no vencimento)", async () => {
    for (const forma of ["boleto", "cartao_credito"]) {
      const c = await conta((await captura({ categoria: "aluguel", formaPagamento: forma })).contaId);
      assert.equal(c.status, "em_aberto", forma);
      assert.equal(c.dataVencimento, "2026-10-03", forma);
    }
  });

  await teste("4. cartão de crédito com dia de vencimento configurado entra para pagar nesse dia", async () => {
    await prisma.configuracaoFormaPagamento.create({ data: { empresaId: empresa.id, chave: "cartao_credito", baixaAutomatica: false, diaVencimento: 10, atualizadoEm: iso() } });
    const c = await conta((await captura({ categoria: "aluguel", formaPagamento: "cartao_credito" })).contaId);
    assert.equal(c.status, "em_aberto");
    assert.equal(c.dataVencimento, "2026-10-10");
    const depois = await conta((await captura({ categoria: "aluguel", formaPagamento: "cartao_credito", data: "2026-10-20" })).contaId);
    assert.equal(depois.dataVencimento, "2026-11-10", "dia já passou: vence no mês seguinte");
  });

  await teste("5. a empresa pode desligar a baixa automática do PIX", async () => {
    await prisma.configuracaoFormaPagamento.create({ data: { empresaId: empresa.id, chave: "pix", baixaAutomatica: false, diaVencimento: null, atualizadoEm: iso() } });
    const c = await conta((await captura({ categoria: "aluguel", formaPagamento: "pix" })).contaId);
    assert.equal(c.status, "em_aberto");
    await prisma.configuracaoFormaPagamento.delete({ where: { empresaId_chave: { empresaId: empresa.id, chave: "pix" } } });
  });

  await teste("6. conta parcelada nunca baixa sozinha, mesmo em forma com baixa automática", async () => {
    const r = await captura({
      categoria: "aluguel",
      formaPagamento: "pix",
      valor: 100,
      parcelas: [
        { valor: 50, dataVencimento: "2026-11-03" },
        { valor: 50, dataVencimento: "2026-12-03" },
      ],
    });
    const contas = await prisma.contaFinanceira.findMany({ where: { empresaId: empresa.id, descricao: { startsWith: "Compra de teste (parcela" } } });
    assert.equal(r.contasCriadas, 2);
    assert.ok(contas.length >= 2 && contas.every((c) => c.status === "em_aberto"));
  });

  await teste("7. a configuração é de cada empresa: a de uma não vale para outra", async () => {
    const outra = await prisma.empresa.create({
      data: { documento: `${marca}-b`, razaoSocial: `${marca} Outra`, tipoPessoa: "pj", plano: "ativo", aceiteTermosVersao: "teste", aceiteTermosEm: iso(), criadoEm: iso(), atualizadoEm: iso() },
    });
    const obraOutra = await prisma.obra.create({
      data: { empresaId: outra.id, nome: `${marca} Projeto B`, cliente: "Cliente", status: "em_andamento", dataInicio: "2026-10-01", criadoEm: iso(), atualizadoEm: iso() },
    });
    const r = await registrarCaptura({ empresaId: outra.id, nome: "Teste" }, {
      tipoDocumento: "comprovante",
      obraId: obraOutra.id,
      valor: 100,
      data: "2026-10-20",
      favorecido: "F",
      descricao: "Outra empresa",
      comprovanteUrl: "",
      itens: [],
      categoria: "aluguel",
      formaPagamento: "cartao_credito",
    });
    assert.equal((await conta(r.contaId)).dataVencimento, "2026-10-20", "o dia 10 da empresa A não pode valer na B");
  });
}

async function limpar(): Promise<void> {
  const empresas = await prisma.empresa.findMany({ where: { razaoSocial: { startsWith: marca } }, select: { id: true } });
  const ids = empresas.map((e) => e.id);
  await prisma.$transaction([
    prisma.contaFinanceira.deleteMany({ where: { empresaId: { in: ids } } }),
    prisma.configuracaoFormaPagamento.deleteMany({ where: { empresaId: { in: ids } } }),
    prisma.obra.deleteMany({ where: { empresaId: { in: ids } } }),
    prisma.empresa.deleteMany({ where: { id: { in: ids } } }),
  ]);
}

main()
  .catch((err) => {
    resultados.push({ nome: "preparação", ok: false, erro: err instanceof Error ? (err.stack ?? err.message) : String(err) });
  })
  .finally(async () => {
    await limpar().catch((err) => console.error("FALHA NA LIMPEZA — conferir registros com o marcador", marca, err));
    const sobras = await prisma.empresa.count({ where: { razaoSocial: { startsWith: marca } } }).catch(() => -1);
    await prisma.$disconnect();
    for (const r of resultados) console.log(`${r.ok ? "ok    " : "FALHOU"} ${r.nome}${r.erro ? `\n       ${r.erro}` : ""}`);
    const falhas = resultados.filter((r) => !r.ok).length;
    console.log(`\n${resultados.length - falhas}/${resultados.length} cenários passaram. Empresas que sobraram: ${sobras}.`);
    process.exit(falhas === 0 && sobras === 0 ? 0 : 1);
  });
