import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { confirmarPagamentoUnico, processarAssinaturasComerciais, reservarVaga } from "../src/services/data/server/assinaturaComercialCore.server";
import { agendarAvisoWhatsapp, enviarAvisosWhatsapp } from "../src/services/data/server/whatsappAvisosCore.server";
import { gerarCodigoDeVinculo, tratarMensagemRecebida } from "../src/services/data/server/whatsappCore.server";

// Teste de integração dos avisos da conta pelo WhatsApp contra o banco, com o envio FALSO (nada sai para fora).
// Cria empresas, usuários e planos descartáveis (marcador aleatório) e apaga SÓ o que criou.
// Rodar contra o banco DEMO (nunca o de produção): ver "Testes de integração" no README.

// O recurso só agenda com o WhatsApp "configurado": valores de mentira, o envio de verdade nunca é chamado aqui.
Object.assign(process.env, { WHATSAPP_PROVEDOR: "uazapi", UAZAPI_URL: "https://exemplo.invalid", UAZAPI_TOKEN: "t", WHATSAPP_NUMERO_ELO: "5521985097600" });

const prisma = new PrismaClient();
const marca = `wav-teste-${randomBytes(3).toString("hex")}`;
const iso = (d: Date = new Date()) => d.toISOString();
const DIA = 86_400_000;
/** 12h em São Paulo: dentro do horário de envio. */
const MEIO_DIA = new Date("2026-11-25T15:00:00Z");

const resultados: { nome: string; ok: boolean; erro?: string }[] = [];
async function teste(nome: string, corpo: () => Promise<void>): Promise<void> {
  try {
    await corpo();
    resultados.push({ nome, ok: true });
  } catch (e) {
    resultados.push({ nome, ok: false, erro: e instanceof Error ? (e.stack ?? e.message) : String(e) });
  }
}

let seq = 0;
async function criarEmpresa(): Promise<string> {
  const n = ++seq;
  const e = await prisma.empresa.create({
    data: { documento: `${marca}-${n}`, razaoSocial: `${marca} ${n}`, tipoPessoa: "pj", plano: "ativo", aceiteTermosVersao: "teste", aceiteTermosEm: iso(), primeiraPublicacaoEm: iso(), criadoEm: iso(), atualizadoEm: iso() },
  });
  return e.id;
}

async function criarUsuario(empresaId: string, opcoes: { papel?: "dono" | "membro"; vincular?: boolean } = {}): Promise<{ id: string; chatId: string }> {
  const n = ++seq;
  const u = await prisma.usuario.create({
    data: { empresaId, nome: "Ana Obras", email: `${marca}-${n}@teste.local`, senhaHash: "x", papel: opcoes.papel ?? "dono", criadoEm: iso(), atualizadoEm: iso() },
  });
  const chatId = `${marca}${n}@c.us`;
  if (opcoes.vincular !== false) {
    const { codigo } = await gerarCodigoDeVinculo(u.id);
    assert.equal((await tratarMensagemRecebida({ chatId, texto: `VINCULAR ${codigo}`, numero: null, mensagemId: null, midia: null })).tipo, "vinculado");
  }
  return { id: u.id, chatId };
}

function enviadorFalso(falhar = false) {
  const enviadas: { chatId: string; texto: string }[] = [];
  return {
    enviadas,
    enviar: async (chatId: string, texto: string) => {
      if (falhar) throw new Error("provedor fora do ar");
      enviadas.push({ chatId, texto });
    },
  };
}

const rodada = (empresaId: string, extra: Partial<Parameters<typeof enviarAvisosWhatsapp>[0]> = {}) =>
  enviarAvisosWhatsapp({ agora: MEIO_DIA, intervaloMs: 0, teto: 1000, apenasEmpresas: [empresaId], ...extra });

const novoAviso = (empresaId: string, chave: string, expiraEm = new Date(MEIO_DIA.getTime() + DIA)) =>
  agendarAvisoWhatsapp(prisma, { empresaId, tipo: "fim_do_teste", chave: `${marca}:${chave}`, texto: "Seu teste termina amanhã.", expiraEm, agora: new Date(MEIO_DIA.getTime() - 60_000) });

async function main(): Promise<void> {
  await teste("1. só donos ativos, vinculados e com avisos ligados entram na fila", async () => {
    const e = await criarEmpresa();
    const dono = await criarUsuario(e);
    await criarUsuario(e, { papel: "membro" });
    await criarUsuario(e, { vincular: false });
    const donoDesligou = await criarUsuario(e);
    await prisma.vinculoWhatsapp.update({ where: { usuarioId: donoDesligou.id }, data: { avisosAtivos: false } });
    assert.equal(await novoAviso(e, "a"), 1);
    const fila = await prisma.avisoWhatsapp.findMany({ where: { empresaId: e } });
    assert.deepEqual(fila.map((f) => f.usuarioId), [dono.id]);
  });

  await teste("2. o mesmo aviso não entra duas vezes; sem WhatsApp configurado, nada é agendado", async () => {
    const e = await criarEmpresa();
    await criarUsuario(e);
    assert.equal(await novoAviso(e, "b"), 1);
    assert.equal(await novoAviso(e, "b"), 0);
    const url = process.env.UAZAPI_URL;
    delete process.env.UAZAPI_URL;
    try {
      assert.equal(await novoAviso(e, "c"), 0);
    } finally {
      process.env.UAZAPI_URL = url;
    }
    assert.equal(await prisma.avisoWhatsapp.count({ where: { empresaId: e } }), 1);
  });

  await teste("3. no horário, o aviso vai para o chat vinculado e fica marcado como enviado", async () => {
    const e = await criarEmpresa();
    const dono = await criarUsuario(e);
    await novoAviso(e, "d");
    const f = enviadorFalso();
    const r = await rodada(e, { enviar: f.enviar });
    assert.equal(r.enviados, 1);
    assert.deepEqual(f.enviadas, [{ chatId: dono.chatId, texto: "Seu teste termina amanhã." }]);
    assert.equal((await prisma.avisoWhatsapp.findFirstOrThrow({ where: { empresaId: e } })).status, "enviado");
    assert.equal((await rodada(e, { enviar: f.enviar })).enviados, 0, "não reenvia");
  });

  await teste("4. fora do horário (madrugada) o aviso espera", async () => {
    const e = await criarEmpresa();
    await criarUsuario(e);
    await novoAviso(e, "e");
    const f = enviadorFalso();
    const r = await rodada(e, { enviar: f.enviar, agora: new Date("2026-11-26T02:00:00Z") }); // 23h em São Paulo
    assert.equal(r.enviados, 0);
    assert.equal(r.foraDoHorario, 1);
    assert.equal((await prisma.avisoWhatsapp.findFirstOrThrow({ where: { empresaId: e } })).status, "pendente");
  });

  await teste("5. quem desligou os avisos ou desvinculou depois de agendar não recebe", async () => {
    const e = await criarEmpresa();
    const d1 = await criarUsuario(e);
    const d2 = await criarUsuario(e);
    await novoAviso(e, "f");
    await prisma.vinculoWhatsapp.update({ where: { usuarioId: d1.id }, data: { avisosAtivos: false } });
    await prisma.vinculoWhatsapp.delete({ where: { usuarioId: d2.id } });
    const f = enviadorFalso();
    const r = await rodada(e, { enviar: f.enviar });
    assert.equal(r.enviados, 0);
    assert.equal(r.cancelados, 2);
    assert.deepEqual(f.enviadas, []);
  });

  await teste("6. aviso que expirou é cancelado, nunca enviado atrasado", async () => {
    const e = await criarEmpresa();
    await criarUsuario(e);
    await novoAviso(e, "g", new Date(MEIO_DIA.getTime() - 1000 + 60_000));
    const f = enviadorFalso();
    const r = await rodada(e, { enviar: f.enviar, agora: new Date(MEIO_DIA.getTime() + 2 * 60_000) });
    assert.equal(r.enviados, 0);
    assert.equal((await prisma.avisoWhatsapp.findFirstOrThrow({ where: { empresaId: e } })).status, "cancelado");
  });

  await teste("7. falha do provedor: tenta de novo mais tarde e desiste na terceira", async () => {
    const e = await criarEmpresa();
    await criarUsuario(e);
    await novoAviso(e, "h", new Date(MEIO_DIA.getTime() + 2 * DIA));
    const quebrado = enviadorFalso(true);
    await rodada(e, { enviar: quebrado.enviar });
    let a = await prisma.avisoWhatsapp.findFirstOrThrow({ where: { empresaId: e } });
    assert.equal(a.status, "pendente");
    assert.equal(a.tentativas, 1);
    assert.ok(a.proximaTentativaEm > MEIO_DIA.toISOString(), "espera antes de tentar de novo");
    assert.equal((await rodada(e, { enviar: quebrado.enviar })).falhas, 0, "antes da hora não tenta");
    // 2ª tentativa 1 h depois da 1ª; a 3ª, 4 h depois da 2ª (tudo dentro do horário de São Paulo).
    const segunda = new Date(MEIO_DIA.getTime() + 61 * 60_000);
    await rodada(e, { enviar: quebrado.enviar, agora: segunda });
    await rodada(e, { enviar: quebrado.enviar, agora: new Date(segunda.getTime() + 241 * 60_000) });
    a = await prisma.avisoWhatsapp.findFirstOrThrow({ where: { empresaId: e } });
    assert.equal(a.tentativas, 3);
    assert.equal(a.status, "falhou");
  });

  await teste("8. teto diário atingido: ninguém recebe nesta rodada", async () => {
    const e = await criarEmpresa();
    await criarUsuario(e);
    await novoAviso(e, "i");
    const f = enviadorFalso();
    const r = await rodada(e, { enviar: f.enviar, teto: 0 });
    assert.equal(r.tetoAtingido, true);
    assert.equal(r.enviados, 0);
  });

  await teste("9. renovação perto do vencimento e suspensão por vencimento geram avisos (uma vez cada)", async () => {
    const e = await criarEmpresa();
    await criarUsuario(e);
    const chave = `${marca}-p`;
    await prisma.planoComercial.create({
      data: { chave, nome: "Plano Obra", descricao: "Plano de teste.", beneficios: ["x1"], publicado: true, vagasTotal: null, precoMensalCentavos: 10000, precoAnualCentavos: 120000, criadoEm: iso(), atualizadoEm: iso() },
    });
    const reserva = await reservarVaga(e, chave, "anual", "pix");
    await confirmarPagamentoUnico(reserva.id, `${marca}-pg`, "approved");
    await prisma.assinaturaComercial.update({ where: { id: reserva.id }, data: { proximaCobrancaEm: iso(new Date(Date.now() + 5 * DIA)) } });
    await processarAssinaturasComerciais();
    await processarAssinaturasComerciais();
    let fila = await prisma.avisoWhatsapp.findMany({ where: { empresaId: e } });
    assert.deepEqual(fila.map((f) => f.tipo), ["renovacao_plano"]);
    assert.match(fila[0].texto, /assinatura anual do plano Plano Obra vence em/);

    await prisma.assinaturaComercial.update({ where: { id: reserva.id }, data: { proximaCobrancaEm: iso(new Date(Date.now() - 3600_000)) } });
    await processarAssinaturasComerciais();
    fila = await prisma.avisoWhatsapp.findMany({ where: { empresaId: e }, orderBy: { criadoEm: "asc" } });
    assert.deepEqual(fila.map((f) => f.tipo).sort(), ["plano_suspenso", "renovacao_plano"]);
    assert.match(fila.find((f) => f.tipo === "plano_suspenso")!.texto, /somente leitura/);
  });
}

async function limpar(): Promise<void> {
  const empresas = await prisma.empresa.findMany({ where: { razaoSocial: { startsWith: marca } }, select: { id: true } });
  const ids = empresas.map((e) => e.id);
  const usuarioIds = (await prisma.usuario.findMany({ where: { empresaId: { in: ids } }, select: { id: true } })).map((u) => u.id);
  await prisma.$transaction([
    prisma.avisoWhatsapp.deleteMany({ where: { empresaId: { in: ids } } }),
    prisma.eventoProduto.deleteMany({ where: { OR: [{ empresaId: { in: ids } }, { chave: { contains: marca } }] } }),
    prisma.assinaturaComercial.deleteMany({ where: { empresaId: { in: ids } } }),
    prisma.vinculoWhatsapp.deleteMany({ where: { usuarioId: { in: usuarioIds } } }),
    prisma.usuario.deleteMany({ where: { empresaId: { in: ids } } }),
    prisma.empresa.deleteMany({ where: { id: { in: ids } } }),
    prisma.planoComercial.deleteMany({ where: { chave: { startsWith: marca } } }),
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
