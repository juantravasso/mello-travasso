import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { atribuirPlanoComercial } from "../src/services/data/server/planosComerciaisCore.server";

// Teste de integração da regra de vagas do catálogo comercial contra o banco REAL. Cria empresas e planos
// descartáveis (marcador aleatório) e apaga SÓ o que criou.
//
// Rodar: yarn testar:planos   (precisa de .env.local com DATABASE_URL)

const prisma = new PrismaClient();
const marca = `plc-teste-${randomBytes(3).toString("hex")}`;
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

async function criarEmpresa(sufixo: string, plano: "ativo" | "cortesia" | "teste" = "ativo"): Promise<string> {
  const e = await prisma.empresa.create({
    data: { documento: `${marca}-${sufixo}`, razaoSocial: `${marca} ${sufixo}`, tipoPessoa: "pj", plano, aceiteTermosVersao: "teste", aceiteTermosEm: iso(), criadoEm: iso(), atualizadoEm: iso() },
  });
  return e.id;
}

async function criarPlano(sufixo: string, vagasTotal: number | null): Promise<string> {
  const chave = `${marca}-${sufixo}`;
  await prisma.planoComercial.create({ data: { chave, nome: `Plano ${sufixo}`, descricao: "Plano de teste.", beneficios: ["x1"], vagasTotal, criadoEm: iso(), atualizadoEm: iso() } });
  return chave;
}

const falha = async (p: Promise<unknown>, trecho: string) => {
  await assert.rejects(p, (e: Error) => e.message.includes(trecho), `esperava recusar com "${trecho}"`);
};

async function main(): Promise<void> {
  const adminEmpresa = await criarEmpresa("adm");
  const admin = await prisma.usuario.create({
    data: { empresaId: adminEmpresa, nome: `Admin ${marca}`, email: `${marca}-adm@example.test`, senhaHash: "sem-login", papel: "dono", criadoEm: iso(), atualizadoEm: iso() },
  });
  const atribuir = (empresa: string, chave: string | null) => atribuirPlanoComercial(admin.id, empresa, chave, "teste de vagas");
  const chaveDa = async (empresa: string) => (await prisma.empresa.findUnique({ where: { id: empresa }, select: { planoComercialChave: true } }))?.planoComercialChave ?? null;

  await teste("1. a última vaga é de quem chegou primeiro e a seguinte é recusada", async () => {
    const plano = await criarPlano("a", 1);
    const e1 = await criarEmpresa("a1");
    const e2 = await criarEmpresa("a2");
    await atribuir(e1, plano);
    await falha(atribuir(e2, plano), "não tem mais vagas");
    assert.equal(await chaveDa(e1), plano);
    assert.equal(await chaveDa(e2), null);
  });

  await teste("2. duas atribuições ao mesmo tempo para uma vaga: só uma passa", async () => {
    const plano = await criarPlano("b", 1);
    const e1 = await criarEmpresa("b1");
    const e2 = await criarEmpresa("b2");
    const r = await Promise.allSettled([atribuir(e1, plano), atribuir(e2, plano)]);
    assert.equal(r.filter((x) => x.status === "fulfilled").length, 1, "exatamente uma ocupa a vaga");
    const ocupadas = await prisma.empresa.count({ where: { planoComercialChave: plano } });
    assert.equal(ocupadas, 1);
  });

  await teste("3. repetir a atribuição da mesma empresa não consome outra vaga nem é recusado", async () => {
    const plano = await criarPlano("c", 1);
    const e1 = await criarEmpresa("c1");
    await atribuir(e1, plano);
    await atribuir(e1, plano);
    assert.equal(await prisma.empresa.count({ where: { planoComercialChave: plano } }), 1);
  });

  await teste("4. tirar o plano libera a vaga", async () => {
    const plano = await criarPlano("d", 1);
    const e1 = await criarEmpresa("d1");
    const e2 = await criarEmpresa("d2");
    await atribuir(e1, plano);
    await falha(atribuir(e2, plano), "não tem mais vagas");
    await atribuir(e1, null);
    await atribuir(e2, plano);
    assert.equal(await chaveDa(e2), plano);
  });

  await teste("5. empresa que saiu do plano ativo deixa de ocupar a vaga", async () => {
    const plano = await criarPlano("e", 1);
    const e1 = await criarEmpresa("e1");
    const e2 = await criarEmpresa("e2");
    await atribuir(e1, plano);
    await prisma.empresa.update({ where: { id: e1 }, data: { plano: "cortesia" } });
    await atribuir(e2, plano);
    assert.equal(await chaveDa(e2), plano);
  });

  await teste("6. só empresa no plano ativo recebe plano comercial", async () => {
    const plano = await criarPlano("f", null);
    const e1 = await criarEmpresa("f1", "teste");
    await falha(atribuir(e1, plano), "plano Ativo");
  });

  await teste("7. plano inexistente e empresa inexistente são recusados", async () => {
    const e1 = await criarEmpresa("g1");
    await falha(atribuir(e1, `${marca}-nao-existe`), "não encontrado");
    await falha(atribuir("00000000-0000-4000-8000-000000000000", null), "não encontrada");
  });

  await teste("8. plano sem limite aceita quantas empresas forem", async () => {
    const plano = await criarPlano("h", null);
    for (const s of ["h1", "h2", "h3"]) await atribuir(await criarEmpresa(s), plano);
    assert.equal(await prisma.empresa.count({ where: { planoComercialChave: plano } }), 3);
  });
}

async function limpar(): Promise<void> {
  const empresas = await prisma.empresa.findMany({ where: { razaoSocial: { startsWith: marca } }, select: { id: true } });
  const ids = empresas.map((e) => e.id);
  const usuarios = await prisma.usuario.findMany({ where: { empresaId: { in: ids } }, select: { id: true } });
  const usuarioIds = usuarios.map((u) => u.id);
  await prisma.$transaction([
    prisma.logAdmin.deleteMany({ where: { adminUsuarioId: { in: usuarioIds } } }),
    prisma.planoComercial.deleteMany({ where: { chave: { startsWith: marca } } }),
    prisma.usuario.deleteMany({ where: { empresaId: { in: ids } } }),
    prisma.empresa.deleteMany({ where: { id: { in: ids } } }),
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
