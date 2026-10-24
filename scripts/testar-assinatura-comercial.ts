import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { calcularStatusPlano } from "../src/lib/auth/plano";
import { confirmarAssinaturaMensal, confirmarPagamentoAnual, processarAssinaturasComerciais, reservarVaga } from "../src/services/data/server/assinaturaComercialCore.server";
import { atribuirPlanoComercial } from "../src/services/data/server/planosComerciaisCore.server";

// Teste de integração da reserva de vaga do checkout comercial contra o banco REAL — sem chamar o Mercado Pago.
// Cria empresas e planos descartáveis (marcador aleatório) e apaga SÓ o que criou.
//
// Rodar: yarn testar:assinaturas   (precisa de .env.local com DATABASE_URL)

const prisma = new PrismaClient();
const marca = `asc-teste-${randomBytes(3).toString("hex")}`;
const iso = (d: Date = new Date()) => d.toISOString();

const resultados: { nome: string; ok: boolean; erro?: string }[] = [];
async function teste(nome: string, corpo: () => Promise<void>): Promise<void> {
  try {
    await corpo();
    resultados.push({ nome, ok: true });
  } catch (e) {
    resultados.push({ nome, ok: false, erro: e instanceof Error ? (e.stack ?? e.message) : String(e) });
  }
}

async function criarEmpresa(sufixo: string, plano: "teste" | "ativo" | "cortesia" = "teste"): Promise<string> {
  const e = await prisma.empresa.create({
    data: { documento: `${marca}-${sufixo}`, razaoSocial: `${marca} ${sufixo}`, tipoPessoa: "pj", plano, aceiteTermosVersao: "teste", aceiteTermosEm: iso(), criadoEm: iso(), atualizadoEm: iso() },
  });
  return e.id;
}

async function criarPlano(sufixo: string, vagasTotal: number | null, precoAnualCentavos = 120000): Promise<string> {
  const chave = `${marca}-${sufixo}`;
  await prisma.planoComercial.create({
    data: { chave, nome: `Plano ${sufixo}`, descricao: "Plano de teste.", beneficios: ["x1"], publicado: true, vagasTotal, precoMensalCentavos: 10000, precoAnualCentavos, criadoEm: iso(), atualizadoEm: iso() },
  });
  return chave;
}

const falha = async (p: Promise<unknown>, trecho: string) => {
  await assert.rejects(p, (e: Error) => e.message.includes(trecho), `esperava recusar com "${trecho}"`);
};

/** Mesma definição de ocupação usada por reservarVaga: reserva expirada não conta. */
const ocupacao = (chave: string) =>
  prisma.assinaturaComercial.count({ where: { planoChave: chave, OR: [{ status: "ativa" }, { status: "reservada", reservaExpiraEm: { gt: iso() } }] } });

async function main(): Promise<void> {
  await teste("1. a última vaga é de quem reserva primeiro; a segunda reserva é recusada", async () => {
    const plano = await criarPlano("a", 1);
    const e1 = await criarEmpresa("a1");
    const e2 = await criarEmpresa("a2");
    await reservarVaga(e1, plano, "mensal", null);
    await falha(reservarVaga(e2, plano, "mensal", null), "não tem mais vagas");
    assert.equal(await ocupacao(plano), 1);
  });

  await teste("2. duas reservas ao mesmo tempo para uma vaga: só uma passa", async () => {
    const plano = await criarPlano("b", 1);
    const e1 = await criarEmpresa("b1");
    const e2 = await criarEmpresa("b2");
    const r = await Promise.allSettled([reservarVaga(e1, plano, "mensal", null), reservarVaga(e2, plano, "mensal", null)]);
    assert.equal(r.filter((x) => x.status === "fulfilled").length, 1, "exatamente uma reserva a vaga");
    assert.equal(await ocupacao(plano), 1);
  });

  await teste("3. a mesma empresa não pode reservar o mesmo plano/ciclo duas vezes", async () => {
    const plano = await criarPlano("c", null);
    const e1 = await criarEmpresa("c1");
    await reservarVaga(e1, plano, "mensal", null);
    await falha(reservarVaga(e1, plano, "mensal", null), "em andamento ou ativa");
  });

  await teste("4. a mesma empresa pode reservar mensal e anual ao mesmo tempo (ciclos diferentes)", async () => {
    const plano = await criarPlano("d", null);
    const e1 = await criarEmpresa("d1");
    await reservarVaga(e1, plano, "mensal", null);
    await reservarVaga(e1, plano, "anual", 12);
    assert.equal(await prisma.assinaturaComercial.count({ where: { empresaId: e1, planoChave: plano } }), 2);
  });

  await teste("5. reserva expirada libera a vaga para outra empresa", async () => {
    const plano = await criarPlano("e", 1);
    const e1 = await criarEmpresa("e1");
    const e2 = await criarEmpresa("e2");
    const r1 = await reservarVaga(e1, plano, "mensal", null);
    await prisma.assinaturaComercial.update({ where: { id: r1.id }, data: { reservaExpiraEm: iso(new Date(Date.now() - 60_000)) } });
    await reservarVaga(e2, plano, "mensal", null);
    assert.equal(await ocupacao(plano), 1);
  });

  await teste("6. plano sem preço no ciclo pedido é recusado (sob consulta)", async () => {
    const chave = `${marca}-f`;
    await prisma.planoComercial.create({ data: { chave, nome: "Plano f", descricao: "Plano de teste.", beneficios: ["x1"], publicado: true, criadoEm: iso(), atualizadoEm: iso() } });
    const e1 = await criarEmpresa("f1");
    await falha(reservarVaga(e1, chave, "anual", 12), "sob consulta");
  });

  await teste("7. plano inexistente ou despublicado é recusado", async () => {
    const e1 = await criarEmpresa("g1");
    await falha(reservarVaga(e1, `${marca}-nao-existe`, "mensal", null), "não encontrado");
  });

  await teste("8. plano sem limite aceita quantas reservas forem", async () => {
    const plano = await criarPlano("h", null);
    for (const s of ["h1", "h2", "h3"]) await reservarVaga(await criarEmpresa(s), plano, "mensal", null);
    assert.equal(await ocupacao(plano), 3);
  });

  // ---- correções: estado do pagamento, cancelamento, vagas manuais
  const empresa = (id: string) => prisma.empresa.findUniqueOrThrow({ where: { id }, select: { plano: true, planoComercialChave: true, testeTerminaEm: true } });
  let contadorAdmin = 0;
  const admin = async () => {
    const n = ++contadorAdmin;
    const e = await criarEmpresa(`adm${n}`);
    const u = await prisma.usuario.create({ data: { empresaId: e, nome: `Admin ${marca}`, email: `${marca}-adm${n}@example.test`, senhaHash: "sem-login", papel: "dono", criadoEm: iso(), atualizadoEm: iso() } });
    return u.id;
  };

  await teste("9. pagamento anual: pendente primeiro e aprovado depois ativa o plano (a 2ª notificação não é descartada)", async () => {
    const plano = await criarPlano("i", null);
    const e1 = await criarEmpresa("i1");
    const r1 = await reservarVaga(e1, plano, "anual", 12);
    await confirmarPagamentoAnual(r1.id, "pay-1", "pending");
    assert.equal((await empresa(e1)).plano, "teste", "pendente não libera nada");
    await confirmarPagamentoAnual(r1.id, "pay-1", "approved");
    const dep = await empresa(e1);
    assert.equal(dep.plano, "ativo");
    assert.equal(dep.planoComercialChave, plano);
    await confirmarPagamentoAnual(r1.id, "pay-1", "approved");
    assert.equal((await empresa(e1)).plano, "ativo", "repetir a notificação é inofensivo");
  });

  await teste("10. mensal cancelada mantém o acesso até o fim do período pago; o cron então deixa em somente leitura e libera a vaga", async () => {
    const plano = await criarPlano("j", 1);
    const e1 = await criarEmpresa("j1");
    const e2 = await criarEmpresa("j2");
    const r1 = await reservarVaga(e1, plano, "mensal", null);
    await confirmarAssinaturaMensal(r1.id, "pre-1", "authorized");
    assert.equal((await empresa(e1)).plano, "ativo");
    const aposAutorizar = await prisma.assinaturaComercial.findUniqueOrThrow({ where: { id: r1.id } });
    assert.ok(aposAutorizar.proximaCobrancaEm && new Date(aposAutorizar.proximaCobrancaEm).getTime() > Date.now(), "o primeiro mês pago termina no futuro");
    await falha(reservarVaga(e2, plano, "mensal", null), "não tem mais vagas");

    await confirmarAssinaturaMensal(r1.id, "pre-1", "cancelled");
    const cancelada = await prisma.assinaturaComercial.findUniqueOrThrow({ where: { id: r1.id } });
    assert.equal(cancelada.status, "cancelada");
    assert.equal(cancelada.proximaCobrancaEm, aposAutorizar.proximaCobrancaEm, "o fim do período pago não muda ao cancelar");
    assert.equal((await empresa(e1)).plano, "ativo", "pagou o mês: continua com acesso completo");
    await confirmarAssinaturaMensal(r1.id, "pre-1", "cancelled");
    assert.equal((await prisma.assinaturaComercial.findUniqueOrThrow({ where: { id: r1.id } })).proximaCobrancaEm, aposAutorizar.proximaCobrancaEm, "notificação repetida é inofensiva");
    await processarAssinaturasComerciais();
    assert.equal((await empresa(e1)).plano, "ativo", "o cron não suspende antes do fim do período");

    await prisma.assinaturaComercial.update({ where: { id: r1.id }, data: { proximaCobrancaEm: iso(new Date(Date.now() - 3600_000)) } });
    const rodada = await processarAssinaturasComerciais();
    assert.ok(rodada.fimDoAcesso >= 1);
    const dep = await empresa(e1);
    assert.equal(dep.plano, "suspenso");
    assert.equal(calcularStatusPlano({ plano: dep.plano, testeTerminaEm: dep.testeTerminaEm }).somenteLeitura, true, "acabou o período: sem escrita, dados preservados");
    assert.equal((await processarAssinaturasComerciais()).fimDoAcesso, 0, "rodar de novo não repete");
    await reservarVaga(e2, plano, "mensal", null);
  });

  await teste("10b. quem cancelou e assinou de novo o mesmo plano não é suspenso quando o período da assinatura antiga acaba", async () => {
    const plano = await criarPlano("j2", null);
    const e1 = await criarEmpresa("jb1");
    const antiga = await reservarVaga(e1, plano, "mensal", null);
    await confirmarAssinaturaMensal(antiga.id, "pre-5", "authorized");
    await confirmarAssinaturaMensal(antiga.id, "pre-5", "cancelled");
    const nova = await reservarVaga(e1, plano, "mensal", null);
    await confirmarAssinaturaMensal(nova.id, "pre-6", "authorized");
    await prisma.assinaturaComercial.update({ where: { id: antiga.id }, data: { proximaCobrancaEm: iso(new Date(Date.now() - 3600_000)) } });
    await processarAssinaturasComerciais();
    assert.equal((await empresa(e1)).plano, "ativo");
  });

  await teste("11. assinatura pausada suspende e voltar a autorizada reativa", async () => {
    const plano = await criarPlano("k", null);
    const e1 = await criarEmpresa("k1");
    const r1 = await reservarVaga(e1, plano, "mensal", null);
    await confirmarAssinaturaMensal(r1.id, "pre-2", "authorized");
    await confirmarAssinaturaMensal(r1.id, "pre-2", "paused");
    assert.equal((await empresa(e1)).plano, "suspenso");
    await confirmarAssinaturaMensal(r1.id, "pre-2", "authorized");
    assert.equal((await empresa(e1)).plano, "ativo");
  });

  await teste("12. cancelamento de um checkout abandonado não derruba empresas que ocupam o plano por outro caminho", async () => {
    const plano = await criarPlano("l", null);
    const adm = await admin();
    const e1 = await criarEmpresa("l1", "ativo");
    await atribuirPlanoComercial(adm, e1, plano, "teste");
    await falha(reservarVaga(e1, plano, "anual", 12), "já está neste plano");
    const e2 = await criarEmpresa("l2", "ativo");
    await atribuirPlanoComercial(adm, e2, plano, "teste");
    const r2 = await reservarVaga(await criarEmpresa("l3"), plano, "mensal", null);
    await confirmarAssinaturaMensal(r2.id, "pre-3", "cancelled");
    assert.equal((await empresa(e1)).plano, "ativo");
    assert.equal((await empresa(e2)).plano, "ativo");
  });

  await teste("13. vaga atribuída à mão conta no checkout, e checkout em andamento conta na atribuição manual", async () => {
    const plano = await criarPlano("m", 1);
    const adm = await admin();
    const manual = await criarEmpresa("m1", "ativo");
    await atribuirPlanoComercial(adm, manual, plano, "teste");
    await falha(reservarVaga(await criarEmpresa("m2"), plano, "mensal", null), "não tem mais vagas");

    const plano2 = await criarPlano("n", 1);
    await reservarVaga(await criarEmpresa("n1"), plano2, "mensal", null);
    await falha(atribuirPlanoComercial(adm, await criarEmpresa("n2", "ativo"), plano2, "teste"), "não tem mais vagas");
  });

  await teste("14. pagamento aprovado sem vaga não ativa o plano (fica paga_sem_vaga para a administração resolver)", async () => {
    const plano = await criarPlano("o", 1);
    const adm = await admin();
    const e1 = await criarEmpresa("o1");
    const r1 = await reservarVaga(e1, plano, "anual", 12);
    await prisma.assinaturaComercial.update({ where: { id: r1.id }, data: { reservaExpiraEm: iso(new Date(Date.now() - 60_000)) } });
    await atribuirPlanoComercial(adm, await criarEmpresa("o2", "ativo"), plano, "teste");
    await confirmarPagamentoAnual(r1.id, "pay-9", "approved");
    assert.equal((await empresa(e1)).plano, "teste");
    assert.equal((await prisma.assinaturaComercial.findUniqueOrThrow({ where: { id: r1.id } })).status, "paga_sem_vaga");
  });

  await teste("15. o cron suspende o anual vencido (somente leitura) sem derrubar cortesia", async () => {
    const plano = await criarPlano("p", null);
    const e1 = await criarEmpresa("p1");
    const r1 = await reservarVaga(e1, plano, "anual", 12);
    await confirmarPagamentoAnual(r1.id, "pay-10", "approved");
    await prisma.assinaturaComercial.update({ where: { id: r1.id }, data: { proximaCobrancaEm: iso(new Date(Date.now() - 3600_000)) } });
    const cort = await criarEmpresa("p2", "cortesia");
    await processarAssinaturasComerciais();
    assert.equal((await empresa(e1)).plano, "suspenso");
    assert.equal((await empresa(cort)).plano, "cortesia");
  });
}

async function limpar(): Promise<void> {
  const empresas = await prisma.empresa.findMany({ where: { razaoSocial: { startsWith: marca } }, select: { id: true } });
  const ids = empresas.map((e) => e.id);
  const usuarioIds = (await prisma.usuario.findMany({ where: { empresaId: { in: ids } }, select: { id: true } })).map((u) => u.id);
  await prisma.$transaction([
    prisma.eventoProduto.deleteMany({ where: { OR: [{ empresaId: { in: ids } }, { chave: { contains: marca } }] } }),
    prisma.logAdmin.deleteMany({ where: { adminUsuarioId: { in: usuarioIds } } }),
    prisma.usuario.deleteMany({ where: { empresaId: { in: ids } } }),
    prisma.assinaturaComercial.deleteMany({ where: { empresaId: { in: ids } } }),
    prisma.empresa.deleteMany({ where: { id: { in: ids } } }),
    prisma.planoComercial.deleteMany({ where: { chave: { startsWith: marca } } }),
  ]);
}

main()
  .catch((err) => {
    resultados.push({ nome: "preparação", ok: false, erro: err instanceof Error ? (err.stack ?? err.message) : String(err) });
  })
  .finally(async () => {
    await limpar().catch((err) => console.error("FALHA NA LIMPEZA — conferir registros com o marcador", marca, err));
    const empresas = await prisma.empresa.count({ where: { razaoSocial: { startsWith: marca } } }).catch(() => -1);
    const planos = await prisma.planoComercial.count({ where: { chave: { startsWith: marca } } }).catch(() => -1);
    await prisma.$disconnect();
    for (const r of resultados) console.log(`${r.ok ? "ok    " : "FALHOU"} ${r.nome}${r.erro ? `\n         ${r.erro}` : ""}`);
    const falhas = resultados.filter((r) => !r.ok).length;
    console.log(`\n${resultados.length - falhas}/${resultados.length} cenários passaram. Empresas que sobraram: ${empresas}; planos que sobraram: ${planos}.`);
    process.exit(falhas === 0 && empresas === 0 && planos === 0 ? 0 : 1);
  });
