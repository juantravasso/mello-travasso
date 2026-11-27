import { createHash, randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import type { MensagemRecebida } from "../src/lib/whatsapp/vinculo";
import type { DadosExtraidosComprovante } from "../src/types";
import { processarFotoRecebida, type DependenciasFoto } from "../src/services/data/server/whatsappCompraCore.server";
import { responderPendencia } from "../src/services/data/server/whatsappComprovanteCore.server";
import { gerarCodigoDeVinculo, tratarMensagemRecebida } from "../src/services/data/server/whatsappCore.server";

// Teste de integração da foto da nota pelo WhatsApp contra o banco, com WhatsApp e IA FALSOS (nada sai para fora).
// Cria empresas, usuários e produtos descartáveis (marcador aleatório) e apaga SÓ o que criou.
// Rodar contra o banco DEMO (nunca o de produção): ver "Testes de integração" no README.

const prisma = new PrismaClient();
const marca = `waf-teste-${randomBytes(3).toString("hex")}`;
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

let seq = 0;
interface Conta {
  usuarioId: string;
  empresaId: string;
  chatId: string;
}

/** Empresa no plano dado, perfil já publicado, usuário vinculado ao chat. */
async function criarConta(opcoes: { plano?: "teste" | "ativo" | "suspenso"; papel?: "dono" | "membro"; modulos?: string[]; vincular?: boolean } = {}): Promise<Conta> {
  const n = ++seq;
  const e = await prisma.empresa.create({
    data: {
      documento: `${marca}-${n}`,
      razaoSocial: `${marca} ${n}`,
      tipoPessoa: "pj",
      plano: opcoes.plano ?? "ativo",
      aceiteTermosVersao: "teste",
      aceiteTermosEm: iso(),
      primeiraPublicacaoEm: iso(),
      criadoEm: iso(),
      atualizadoEm: iso(),
    },
  });
  const u = await prisma.usuario.create({
    data: { empresaId: e.id, nome: "João Pedreira", email: `${marca}-${n}@teste.local`, senhaHash: "x", papel: opcoes.papel ?? "dono", modulos: opcoes.modulos ?? [], criadoEm: iso(), atualizadoEm: iso() },
  });
  const chatId = `${marca}${n}@c.us`;
  if (opcoes.vincular !== false) {
    const { codigo } = await gerarCodigoDeVinculo(u.id);
    const r = await tratarMensagemRecebida({ chatId, texto: `VINCULAR ${codigo}`, numero: null, mensagemId: null, midia: null });
    assert.equal(r.tipo, "vinculado");
  }
  return { usuarioId: u.id, empresaId: e.id, chatId };
}

const foto = (chatId: string, id: string = randomBytes(6).toString("hex")): MensagemRecebida => ({
  chatId,
  texto: "",
  numero: null,
  mensagemId: `${marca}-${id}`,
  midia: { tipo: "imagem", url: null, mimetype: "image/jpeg" },
});

const PIX: DadosExtraidosComprovante = {
  tipoDocumento: "comprovante",
  valor: 350,
  data: "2026-11-24",
  favorecido: "José da Silva",
  confiancaExtracao: 0.95,
  camposComBaixaConfianca: [],
};

const texto = (chatId: string, t: string): MensagemRecebida => ({ chatId, texto: t, numero: null, mensagemId: null, midia: null });

async function criarProjeto(empresaId: string, nome: string): Promise<string> {
  const o = await prisma.obra.create({ data: { empresaId, nome, cliente: "Cliente", status: "em_andamento", dataInicio: "2026-11-01", criadoEm: iso(), atualizadoEm: iso() } });
  return o.id;
}

const NOTA: DadosExtraidosComprovante = {
  tipoDocumento: "nota_fiscal",
  favorecido: "Casa do Construtor",
  data: "2026-11-20",
  itens: [
    { descricao: "Cimento CP II 50kg", quantidade: 10, unidade: "SC", valorUnitario: 38.9 },
    { descricao: "Areia média", quantidade: 2, valorTotal: 300 },
  ],
  confiancaExtracao: 0.9,
  camposComBaixaConfianca: [],
};

function falsos(leitura: DadosExtraidosComprovante | null = NOTA, mimetype = "image/jpeg") {
  const enviadas: string[] = [];
  let leituras = 0;
  const deps: DependenciasFoto = {
    baixar: async () => ({ base64: "AAAA", mimetype, bytes: 3 }),
    extrair: async () => {
      leituras++;
      return leitura ? { sucesso: true, dados: leitura } : { sucesso: false, erro: "falhou" };
    },
    responder: async (_chat, texto) => {
      enviadas.push(texto);
    },
  };
  return { deps, enviadas, leituras: () => leituras, responder: deps.responder };
}

async function main(): Promise<void> {
  const recursosAtivo = await prisma.planoRecurso.findMany({ where: { plano: "ativo" }, select: { recursoChave: true } });
  assert.ok(recursosAtivo.some((r) => r.recursoChave === "gestao"), "o banco precisa do plano 'ativo' com o recurso 'gestao'");

  await teste("1. foto de quem está vinculado vira rascunho no Depósito, com resumo e link", async () => {
    const c = await criarConta();
    const f = falsos();
    assert.equal(await processarFotoRecebida(foto(c.chatId), f.deps), "rascunho");
    const compras = await prisma.compra.findMany({ where: { empresaId: c.empresaId }, include: { itens: true, obra: true } });
    assert.equal(compras.length, 1);
    const compra = compras[0];
    assert.equal(compra.status, "rascunho", "nunca efetiva sozinho");
    assert.equal(compra.origem, "foto");
    assert.equal(compra.obra.ehDeposito, true, "destino padrão é o Depósito");
    assert.equal(compra.fornecedorNome, "Casa do Construtor");
    assert.equal(compra.itens.length, 2);
    assert.equal(compra.valorTotal, 689);
    assert.ok(compra.comprovanteUrl.startsWith("data:image/jpeg;base64,"), "a foto fica guardada como comprovante");
    assert.equal(await prisma.contaFinanceira.count({ where: { empresaId: c.empresaId } }), 0, "nenhuma conta a pagar antes de efetivar");
    assert.equal(f.enviadas[0], "Recebi a foto. Lendo a nota…");
    assert.match(f.enviadas[1], /lançada como rascunho/);
    assert.match(f.enviadas[1], new RegExp(`/compras/${compra.id}`));
    assert.match(f.enviadas[1], /Cimento CP II 50kg → produto novo criado/);
    assert.match(f.enviadas[1], /Areia média → produto novo criado/);
    assert.ok(compra.itens.every((i) => i.produtoId), "todo item sai ligado a um produto (existente ou criado)");
    assert.equal(await prisma.produto.count({ where: { empresaId: c.empresaId } }), 2, "os dois produtos foram criados");
  });

  await teste("2. a mesma mensagem duas vezes (reenvio do webhook) lê e lança uma vez só", async () => {
    const c = await criarConta();
    const f = falsos();
    const m = foto(c.chatId, "repetida");
    assert.equal(await processarFotoRecebida(m, f.deps), "rascunho");
    assert.equal(await processarFotoRecebida(m, f.deps), "repetida");
    assert.equal(f.leituras(), 1);
    assert.equal(await prisma.compra.count({ where: { empresaId: c.empresaId } }), 1);
  });

  await teste("3. número não vinculado: nada é lido, nada é lançado e o robô fica calado (pode ser suporte)", async () => {
    const f = falsos();
    assert.equal(await processarFotoRecebida(foto(`${marca}-estranho@c.us`), f.deps), "nao_vinculado");
    assert.equal(f.leituras(), 0);
    assert.deepEqual(f.enviadas, []);
  });

  await teste("4. empresa em somente leitura não lança", async () => {
    const c = await criarConta({ plano: "suspenso" });
    const f = falsos();
    assert.equal(await processarFotoRecebida(foto(c.chatId), f.deps), "somente_leitura");
    assert.equal(f.leituras(), 0);
    assert.equal(await prisma.compra.count({ where: { empresaId: c.empresaId } }), 0);
    assert.match(f.enviadas[0], /somente leitura/);
  });

  await teste("5. membro sem o módulo de captura não lança; com o módulo, lança", async () => {
    const dono = await criarConta();
    const semModulo = await prisma.usuario.create({
      data: { empresaId: dono.empresaId, nome: "Membro", email: `${marca}-m1@teste.local`, senhaHash: "x", papel: "membro", modulos: ["estoque"], criadoEm: iso(), atualizadoEm: iso() },
    });
    const chatSem = `${marca}-m1@c.us`;
    const { codigo } = await gerarCodigoDeVinculo(semModulo.id);
    await tratarMensagemRecebida({ chatId: chatSem, texto: `VINCULAR ${codigo}`, numero: null, mensagemId: null, midia: null });
    const f = falsos();
    assert.equal(await processarFotoRecebida(foto(chatSem), f.deps), "sem_acesso");
    assert.equal(f.leituras(), 0);

    await prisma.usuario.update({ where: { id: semModulo.id }, data: { modulos: ["captura"] } });
    assert.equal(await processarFotoRecebida(foto(chatSem), falsos().deps), "rascunho");
  });

  await teste("6. usuário desativado pelo dono não lança mais", async () => {
    const c = await criarConta();
    await prisma.usuario.update({ where: { id: c.usuarioId }, data: { desativadoEm: iso() } });
    const f = falsos();
    assert.equal(await processarFotoRecebida(foto(c.chatId), f.deps), "sem_acesso");
    assert.equal(f.leituras(), 0);
  });

  await teste("7. PDF ou documento: pede foto e não chama a IA", async () => {
    const c = await criarConta();
    const f = falsos();
    const doc = { ...foto(c.chatId), midia: { tipo: "outra" as const, url: null, mimetype: "application/pdf" } };
    assert.equal(await processarFotoRecebida(doc, f.deps), "formato");
    const f2 = falsos(NOTA, "image/gif");
    assert.equal(await processarFotoRecebida(foto(c.chatId), f2.deps), "formato", "formato de imagem que a IA não lê");
    assert.equal(f.leituras() + f2.leituras(), 0);
  });

  await teste("8. a IA não leu: avisa e não cria compra", async () => {
    const c = await criarConta();
    const f = falsos(null);
    assert.equal(await processarFotoRecebida(foto(c.chatId), f.deps), "nao_leu");
    const f2 = falsos({ ...NOTA, confiancaExtracao: 0 });
    assert.equal(await processarFotoRecebida(foto(c.chatId), f2.deps), "nao_leu", "confiança zero (IA sem chave) não lança");
    assert.equal(await prisma.compra.count({ where: { empresaId: c.empresaId } }), 0);
  });

  await teste("9. item com nome de produto existente usa o existente; o resto vira produto novo; nada é duplicado", async () => {
    const c = await criarConta();
    await prisma.produto.create({ data: { empresaId: c.empresaId, nome: "Cimento CP II 50kg", criadoEm: iso(), atualizadoEm: iso() } });
    const f = falsos();
    assert.equal(await processarFotoRecebida(foto(c.chatId), f.deps), "rascunho");
    const itens = await prisma.compraItem.findMany({ where: { compra: { empresaId: c.empresaId } }, orderBy: { ordem: "asc" } });
    const cimento = await prisma.produto.findFirstOrThrow({ where: { empresaId: c.empresaId, nome: "Cimento CP II 50kg" } });
    assert.equal(itens[0].produtoId, cimento.id, "cimento ligado ao produto que já existia");
    assert.ok(itens[1].produtoId && itens[1].produtoId !== cimento.id, "areia virou produto novo");
    assert.equal(await prisma.produto.count({ where: { empresaId: c.empresaId } }), 2);
    assert.match(f.enviadas[1], /Cimento CP II 50kg → Cimento CP II 50kg\n/);
    assert.match(f.enviadas[1], /Areia média → produto novo criado/);
    // A segunda nota igual reaproveita os dois produtos (nada de duplicar o catálogo).
    assert.equal(await processarFotoRecebida(foto(c.chatId), falsos().deps), "rascunho");
    assert.equal(await prisma.produto.count({ where: { empresaId: c.empresaId } }), 2);
  });

  await teste("11. comprovante com um projeto só: pergunta a categoria e lança a conta, com a foto", async () => {
    const c = await criarConta();
    const projeto = await criarProjeto(c.empresaId, "Casa Barra");
    const f = falsos(PIX);
    assert.equal(await processarFotoRecebida(foto(c.chatId), f.deps), "pergunta");
    assert.match(f.enviadas.at(-1)!, /Do que se trata\?/);
    assert.equal(await prisma.compra.count({ where: { empresaId: c.empresaId } }), 0, "comprovante não vira compra");
    assert.equal(await responderPendencia(texto(c.chatId, "2"), f.responder), "lancado");
    const contas = await prisma.contaFinanceira.findMany({ where: { empresaId: c.empresaId } });
    assert.equal(contas.length, 1);
    assert.equal(contas[0].obraId, projeto);
    assert.equal(contas[0].valor, 350);
    assert.equal(contas[0].categoria, "custo_funcionario");
    assert.equal(contas[0].formaPagamento, "pix");
    assert.equal(contas[0].favorecidoOuCliente, "José da Silva");
    assert.ok(contas[0].comprovanteUrl.startsWith("data:image/jpeg;base64,"));
    assert.equal(await prisma.pendenciaWhatsapp.count({ where: { empresaId: c.empresaId } }), 0, "a pergunta se encerra");
    assert.match(f.enviadas.at(-1)!, /Pagamento de funcionário de R\$\s?350,00 para José da Silva, no projeto Casa Barra/);
    assert.ok(f.enviadas.at(-1)!.includes(`/contas-a-pagar/${contas[0].id}`));
    console.log(`         (conta do Pix entrou como: ${contas[0].status})`);
  });

  await teste("12. com mais de um projeto, pergunta também o projeto", async () => {
    const c = await criarConta();
    await criarProjeto(c.empresaId, "Casa Barra");
    const tijuca = await criarProjeto(c.empresaId, "Reforma Tijuca");
    const f = falsos(PIX);
    await processarFotoRecebida(foto(c.chatId), f.deps);
    assert.equal(await responderPendencia(texto(c.chatId, "1"), f.responder), "pergunta");
    const pergunta = f.enviadas.at(-1)!;
    assert.match(pergunta, /Para qual projeto\?/);
    const linha = pergunta.split("\n").find((l) => l.includes("Reforma Tijuca"))!;
    assert.equal(await responderPendencia(texto(c.chatId, linha.split(".")[0]), f.responder), "lancado");
    const conta = await prisma.contaFinanceira.findFirstOrThrow({ where: { empresaId: c.empresaId } });
    assert.equal(conta.obraId, tijuca);
    assert.equal(conta.categoria, "custo_produtos");
  });

  await teste("13. CANCELAR encerra sem lançar; número fora da lista pede de novo; conversa comum fica em silêncio", async () => {
    const c = await criarConta();
    await criarProjeto(c.empresaId, "Casa Barra");
    const f = falsos(PIX);
    await processarFotoRecebida(foto(c.chatId), f.deps);
    const antes = f.enviadas.length;
    assert.equal(await responderPendencia(texto(c.chatId, "bom dia, tudo bem com o pedido?"), f.responder), "ignorada", "texto livre vai para o assistente");
    assert.equal(f.enviadas.length, antes, "texto livre (pode ser suporte) não recebe resposta do robô");
    assert.equal(await responderPendencia(texto(c.chatId, "9"), f.responder), "invalida");
    assert.match(f.enviadas.at(-1)!, /de 1 a 5/);
    assert.equal(await responderPendencia(texto(c.chatId, "cancelar"), f.responder), "cancelado");
    assert.equal(await prisma.contaFinanceira.count({ where: { empresaId: c.empresaId } }), 0);
    assert.equal(await responderPendencia(texto(c.chatId, "2"), f.responder), "sem_pendencia", "depois de cancelar, número não lança nada");
  });

  await teste("14. sem projeto cadastrado: avisa e não lança", async () => {
    const c = await criarConta();
    const f = falsos(PIX);
    await processarFotoRecebida(foto(c.chatId), f.deps);
    assert.equal(await responderPendencia(texto(c.chatId, "5"), f.responder), "sem_projeto");
    assert.equal(await prisma.contaFinanceira.count({ where: { empresaId: c.empresaId } }), 0);
  });

  await teste("15. a mesma resposta duas vezes ao mesmo tempo lança uma conta só", async () => {
    const c = await criarConta();
    await criarProjeto(c.empresaId, "Casa Barra");
    const f = falsos(PIX);
    await processarFotoRecebida(foto(c.chatId), f.deps);
    await Promise.all([responderPendencia(texto(c.chatId, "3"), f.responder), responderPendencia(texto(c.chatId, "3"), f.responder)]);
    assert.equal(await prisma.contaFinanceira.count({ where: { empresaId: c.empresaId } }), 1);
  });

  await teste("16. pergunta vencida não lança; quem perdeu o acesso no meio da conversa também não", async () => {
    const c = await criarConta();
    await criarProjeto(c.empresaId, "Casa Barra");
    const f = falsos(PIX);
    await processarFotoRecebida(foto(c.chatId), f.deps);
    await prisma.pendenciaWhatsapp.updateMany({ where: { empresaId: c.empresaId }, data: { expiraEm: iso(new Date(Date.now() - 1000)) } });
    assert.equal(await responderPendencia(texto(c.chatId, "1"), f.responder), "expirado");
    assert.match(f.enviadas.at(-1)!, /expirou/);

    await processarFotoRecebida(foto(c.chatId), f.deps);
    await prisma.empresa.update({ where: { id: c.empresaId }, data: { plano: "suspenso" } });
    assert.equal(await responderPendencia(texto(c.chatId, "1"), f.responder), "negado");
    assert.equal(await prisma.contaFinanceira.count({ where: { empresaId: c.empresaId } }), 0);
  });

  await teste("10. limite de leituras por hora vale também pelo WhatsApp", async () => {
    const c = await criarConta();
    const chave = createHash("sha256").update(`ia-extract:${c.empresaId}`).digest("hex");
    await prisma.$executeRaw`INSERT INTO "LimiteTaxa" ("chave", "janelaInicio", "contagem") VALUES (${chave}, ${iso()}, 30) ON CONFLICT ("chave") DO UPDATE SET "contagem" = 30, "janelaInicio" = ${iso()}`;
    const f = falsos();
    const r = await processarFotoRecebida(foto(c.chatId), f.deps);
    await prisma.$executeRaw`DELETE FROM "LimiteTaxa" WHERE "chave" = ${chave}`;
    assert.equal(r, "limite");
    assert.equal(f.leituras(), 0);
  });
}

async function limpar(): Promise<void> {
  const empresas = await prisma.empresa.findMany({ where: { razaoSocial: { startsWith: marca } }, select: { id: true } });
  const ids = empresas.map((e) => e.id);
  const usuarioIds = (await prisma.usuario.findMany({ where: { empresaId: { in: ids } }, select: { id: true } })).map((u) => u.id);
  await prisma.$transaction([
    prisma.eventoProduto.deleteMany({ where: { OR: [{ empresaId: { in: ids } }, { chave: { contains: marca } }] } }),
    prisma.pendenciaWhatsapp.deleteMany({ where: { empresaId: { in: ids } } }),
    prisma.rateioConta.deleteMany({ where: { contaFinanceira: { empresaId: { in: ids } } } }),
    prisma.contaFinanceira.deleteMany({ where: { empresaId: { in: ids } } }),
    prisma.compraItem.deleteMany({ where: { compra: { empresaId: { in: ids } } } }),
    prisma.compra.deleteMany({ where: { empresaId: { in: ids } } }),
    prisma.vinculoProduto.deleteMany({ where: { empresaId: { in: ids } } }),
    prisma.produto.deleteMany({ where: { empresaId: { in: ids } } }),
    prisma.obra.deleteMany({ where: { empresaId: { in: ids } } }),
    prisma.vinculoWhatsapp.deleteMany({ where: { usuarioId: { in: usuarioIds } } }),
    prisma.usuario.deleteMany({ where: { empresaId: { in: ids } } }),
    prisma.empresa.deleteMany({ where: { id: { in: ids } } }),
  ]);
  for (const id of ids) {
    const chave = createHash("sha256").update(`ia-extract:${id}`).digest("hex");
    await prisma.$executeRaw`DELETE FROM "LimiteTaxa" WHERE "chave" = ${chave}`;
  }
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
