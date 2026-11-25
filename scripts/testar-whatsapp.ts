import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { hashCodigo } from "../src/lib/whatsapp/vinculo";
import { definirAvisos, desfazerVinculo, estadoDoVinculo, gerarCodigoDeVinculo, tratarMensagemRecebida } from "../src/services/data/server/whatsappCore.server";

// Teste de integração do vínculo do WhatsApp contra o banco, sem WAHA e sem enviar mensagem nenhuma.
// Cria empresas e usuários descartáveis (marcador aleatório) e apaga SÓ o que criou.
//
// Rodar contra o banco DEMO (nunca o de produção): ver "Testes de integração" no README.

const prisma = new PrismaClient();
const marca = `wa-teste-${randomBytes(3).toString("hex")}`;
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

async function criarUsuario(sufixo: string, nome = "Maria Souza"): Promise<string> {
  const e = await prisma.empresa.create({
    data: { documento: `${marca}-${sufixo}`, razaoSocial: `${marca} ${sufixo}`, tipoPessoa: "pj", plano: "teste", aceiteTermosVersao: "teste", aceiteTermosEm: iso(), criadoEm: iso(), atualizadoEm: iso() },
  });
  const u = await prisma.usuario.create({ data: { empresaId: e.id, nome, email: `${marca}-${sufixo}@teste.local`, senhaHash: "x", criadoEm: iso(), atualizadoEm: iso() } });
  return u.id;
}

const msg = (texto: string, chatId = "5521999990000@c.us", numero: string | null = "5521999990000") => ({ chatId, texto, numero, mensagemId: null, midia: null });

async function main(): Promise<void> {
  await teste("1. o código gerado vincula o número; o banco guarda só o hash", async () => {
    const u = await criarUsuario("a");
    const { codigo } = await gerarCodigoDeVinculo(u);
    const bruto = await prisma.vinculoWhatsapp.findUniqueOrThrow({ where: { usuarioId: u } });
    assert.equal(bruto.codigoHash, hashCodigo(codigo));
    assert.notEqual(bruto.codigoHash, codigo);
    const r = await tratarMensagemRecebida(msg(`VINCULAR ${codigo}`, `${marca}1@c.us`, "5521911112222"));
    assert.deepEqual(r, { tipo: "vinculado", primeiroNome: "Maria" });
    const est = await estadoDoVinculo(u);
    assert.equal(est.vinculado, true);
    assert.equal(est.avisosAtivos, true);
    assert.equal(est.numeroMascarado, "(21) •••••-2222");
    const depois = await prisma.vinculoWhatsapp.findUniqueOrThrow({ where: { usuarioId: u } });
    assert.equal(depois.codigoHash, null, "o código é de uso único");
  });

  await teste("2. o mesmo código não vale duas vezes", async () => {
    const u = await criarUsuario("b");
    const { codigo } = await gerarCodigoDeVinculo(u);
    await tratarMensagemRecebida(msg(`VINCULAR ${codigo}`, `${marca}2@c.us`));
    const r = await tratarMensagemRecebida(msg(`VINCULAR ${codigo}`, `${marca}3@c.us`));
    assert.deepEqual(r, { tipo: "codigo_invalido" });
  });

  await teste("3. código vencido ou inexistente é recusado", async () => {
    const u = await criarUsuario("c");
    const { codigo } = await gerarCodigoDeVinculo(u);
    await prisma.vinculoWhatsapp.update({ where: { usuarioId: u }, data: { codigoExpiraEm: iso(new Date(Date.now() - 1000)) } });
    assert.deepEqual(await tratarMensagemRecebida(msg(`VINCULAR ${codigo}`, `${marca}4@c.us`)), { tipo: "codigo_invalido" });
    assert.deepEqual(await tratarMensagemRecebida(msg("VINCULAR ZZZZZZZZ", `${marca}4@c.us`)), { tipo: "codigo_invalido" });
    assert.equal((await estadoDoVinculo(u)).vinculado, false);
  });

  await teste("4. conversa comum é ignorada e não vincula nada", async () => {
    const u = await criarUsuario("d");
    await gerarCodigoDeVinculo(u);
    assert.deepEqual(await tratarMensagemRecebida(msg("oi, preciso de ajuda com o plano", `${marca}5@c.us`)), { tipo: "ignorada" });
    assert.equal((await estadoDoVinculo(u)).vinculado, false);
  });

  await teste("5. um WhatsApp só pode estar em uma conta; o código da segunda não é gasto", async () => {
    const u1 = await criarUsuario("e1");
    const u2 = await criarUsuario("e2");
    const c1 = await gerarCodigoDeVinculo(u1);
    await tratarMensagemRecebida(msg(`VINCULAR ${c1.codigo}`, `${marca}6@c.us`));
    const c2 = await gerarCodigoDeVinculo(u2);
    assert.deepEqual(await tratarMensagemRecebida(msg(`VINCULAR ${c2.codigo}`, `${marca}6@c.us`)), { tipo: "chat_em_uso" });
    assert.equal((await estadoDoVinculo(u2)).vinculado, false);
    assert.deepEqual(await tratarMensagemRecebida(msg(`VINCULAR ${c2.codigo}`, `${marca}7@c.us`)), { tipo: "vinculado", primeiroNome: "Maria" }, "o código segue valendo para outro número");
  });

  await teste("6. quem já está vinculado precisa desvincular antes de gerar outro código", async () => {
    const u = await criarUsuario("f");
    const { codigo } = await gerarCodigoDeVinculo(u);
    await tratarMensagemRecebida(msg(`VINCULAR ${codigo}`, `${marca}8@c.us`));
    await assert.rejects(gerarCodigoDeVinculo(u), (e: Error) => e.message === "JA_VINCULADO");
    await desfazerVinculo(u);
    assert.equal((await estadoDoVinculo(u)).vinculado, false);
    await gerarCodigoDeVinculo(u);
  });

  await teste("7. gerar outro código invalida o anterior", async () => {
    const u = await criarUsuario("g");
    const antigo = await gerarCodigoDeVinculo(u);
    const novo = await gerarCodigoDeVinculo(u);
    assert.deepEqual(await tratarMensagemRecebida(msg(`VINCULAR ${antigo.codigo}`, `${marca}9@c.us`)), { tipo: "codigo_invalido" });
    assert.equal((await tratarMensagemRecebida(msg(`VINCULAR ${novo.codigo}`, `${marca}9@c.us`))).tipo, "vinculado");
  });

  await teste("8. avisos: liga e desliga só para quem está vinculado; @lid fica sem número", async () => {
    const u = await criarUsuario("h");
    await definirAvisos(u, true);
    assert.equal((await estadoDoVinculo(u)).avisosAtivos, false, "sem vínculo não há aviso");
    const { codigo } = await gerarCodigoDeVinculo(u);
    await tratarMensagemRecebida(msg(`VINCULAR ${codigo}`, `${marca}10@lid`, null));
    let est = await estadoDoVinculo(u);
    assert.equal(est.numeroMascarado, null);
    await definirAvisos(u, false);
    est = await estadoDoVinculo(u);
    assert.equal(est.vinculado, true);
    assert.equal(est.avisosAtivos, false);
  });

  await teste("9. mensagem de quem já está vinculado atualiza o último contato", async () => {
    const u = await criarUsuario("i");
    const { codigo } = await gerarCodigoDeVinculo(u);
    await tratarMensagemRecebida(msg(`VINCULAR ${codigo}`, `${marca}11@c.us`));
    await prisma.vinculoWhatsapp.update({ where: { usuarioId: u }, data: { ultimaMensagemEm: iso(new Date(Date.now() - 3600_000)) } });
    const antes = (await prisma.vinculoWhatsapp.findUniqueOrThrow({ where: { usuarioId: u } })).ultimaMensagemEm!;
    await tratarMensagemRecebida(msg("bom dia", `${marca}11@c.us`));
    const depois = (await prisma.vinculoWhatsapp.findUniqueOrThrow({ where: { usuarioId: u } })).ultimaMensagemEm!;
    assert.ok(depois > antes);
  });

  await teste("10. duas mensagens iguais ao mesmo tempo vinculam uma vez só", async () => {
    const u = await criarUsuario("j");
    const { codigo } = await gerarCodigoDeVinculo(u);
    const r = await Promise.all([tratarMensagemRecebida(msg(`VINCULAR ${codigo}`, `${marca}12@c.us`)), tratarMensagemRecebida(msg(`VINCULAR ${codigo}`, `${marca}12@c.us`))]);
    assert.equal(r.filter((x) => x.tipo === "vinculado").length, 1);
    assert.equal((await estadoDoVinculo(u)).vinculado, true);
  });
}

async function limpar(): Promise<void> {
  const empresas = await prisma.empresa.findMany({ where: { razaoSocial: { startsWith: marca } }, select: { id: true } });
  const ids = empresas.map((e) => e.id);
  const usuarioIds = (await prisma.usuario.findMany({ where: { empresaId: { in: ids } }, select: { id: true } })).map((u) => u.id);
  await prisma.$transaction([
    prisma.vinculoWhatsapp.deleteMany({ where: { usuarioId: { in: usuarioIds } } }),
    prisma.usuario.deleteMany({ where: { empresaId: { in: ids } } }),
    prisma.empresa.deleteMany({ where: { id: { in: ids } } }),
  ]);
}

main()
  .catch((e) => {
    console.error("Erro inesperado:", e);
    resultados.push({ nome: "execução", ok: false, erro: String(e) });
  })
  .finally(async () => {
    await limpar().catch((err) => console.error("FALHA NA LIMPEZA — conferir registros com o marcador", marca, err));
    const empresas = await prisma.empresa.count({ where: { razaoSocial: { startsWith: marca } } }).catch(() => -1);
    await prisma.$disconnect();
    for (const r of resultados) console.log(`${r.ok ? "ok    " : "FALHOU"} ${r.nome}${r.erro ? `\n         ${r.erro}` : ""}`);
    const falhas = resultados.filter((r) => !r.ok).length;
    console.log(`\n${resultados.length - falhas}/${resultados.length} cenários passaram. Empresas que sobraram: ${empresas}.`);
    process.exit(falhas === 0 && empresas === 0 ? 0 : 1);
  });
