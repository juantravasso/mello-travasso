import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { garantirCodigo, resolverEmpresaConvidante, resumo } from "../src/services/data/server/conviteCore.server";

// Teste de integração do link de convite da empresa contra o banco REAL. Cria empresas descartáveis (o nome leva um
// marcador aleatório), exercita as regras e apaga SÓ o que criou.
//
// Rodar: yarn testar:convite   (precisa de .env.local com DATABASE_URL)

const prisma = new PrismaClient();
const marca = `conv-teste-${randomBytes(3).toString("hex")}`;
const URL_BASE = "https://www.exemplo.com.br";

const resultados: { nome: string; ok: boolean; erro?: string }[] = [];
async function teste(nome: string, corpo: () => Promise<void>): Promise<void> {
  try {
    await corpo();
    resultados.push({ nome, ok: true });
  } catch (e) {
    resultados.push({ nome, ok: false, erro: e instanceof Error ? (e.stack ?? e.message) : String(e) });
  }
}

const iso = () => new Date().toISOString();
async function criarEmpresa(sufixo: string, extra: { convidadaPorId?: string | null; bloqueadaEm?: string } = {}): Promise<string> {
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
      ...extra,
    },
  });
  return e.id;
}

async function main(): Promise<void> {
  const A = await criarEmpresa("A");
  const B = await criarEmpresa("B");
  let codigoA = "";

  await teste("1. cria o código na primeira vez e devolve o mesmo nas seguintes", async () => {
    codigoA = await garantirCodigo(A);
    assert.match(codigoA, /^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{8}$/);
    assert.equal(await garantirCodigo(A), codigoA);
    assert.equal((await prisma.empresa.findUniqueOrThrow({ where: { id: A } })).codigoConvite, codigoA);
  });

  await teste("2. chamadas simultâneas não criam dois códigos", async () => {
    const codigos = await Promise.all(Array.from({ length: 12 }, () => garantirCodigo(B)));
    assert.equal(new Set(codigos).size, 1, `códigos diferentes: ${[...new Set(codigos)].join(", ")}`);
    assert.notEqual(codigos[0], codigoA, "duas empresas ficaram com o mesmo código");
    assert.equal((await prisma.empresa.findUniqueOrThrow({ where: { id: B } })).codigoConvite, codigos[0]);
  });

  await teste("3. o código é único no banco", async () => {
    await assert.rejects(prisma.empresa.update({ where: { id: B }, data: { codigoConvite: codigoA } }), (e: unknown) => (e as { code?: string }).code === "P2002");
  });

  await teste("4. resumo monta o link e começa com zero cadastros", async () => {
    const r = await resumo(A, `${URL_BASE}/`);
    assert.equal(r.codigo, codigoA);
    assert.equal(r.link, `${URL_BASE}/criar-conta?convite=${codigoA}`);
    assert.equal(r.total, 0);
  });

  await teste("5. código válido (também em minúsculas e com espaços) aponta para a empresa certa", async () => {
    assert.equal(await resolverEmpresaConvidante(codigoA), A);
    assert.equal(await resolverEmpresaConvidante(`  ${codigoA.toLowerCase()} `), A);
  });

  await teste("6. código inválido, desconhecido ou de tipo errado é ignorado (null), sem erro", async () => {
    assert.equal(await resolverEmpresaConvidante(undefined), null);
    assert.equal(await resolverEmpresaConvidante(""), null);
    assert.equal(await resolverEmpresaConvidante("curto"), null);
    assert.equal(await resolverEmpresaConvidante("AAAAAAAA"), null, "formato certo mas ninguém tem esse código");
    assert.equal(await resolverEmpresaConvidante(`${codigoA}'; DROP TABLE "Empresa";--`), null);
    assert.equal(await resolverEmpresaConvidante({ codigo: codigoA }), null);
  });

  await teste("7. código de empresa bloqueada pela administração é ignorado", async () => {
    const bloqueada = await criarEmpresa("bloqueada", { bloqueadaEm: iso() });
    const codigo = await garantirCodigo(bloqueada);
    assert.equal(await resolverEmpresaConvidante(codigo), null);
  });

  let convidada = "";
  await teste("8. cadastro pelo link grava quem convidou e a contagem sobe só para quem convidou", async () => {
    const convidanteId = await resolverEmpresaConvidante(codigoA);
    convidada = await criarEmpresa("convidada", { convidadaPorId: convidanteId });
    const semConvite = await criarEmpresa("sem-convite", { convidadaPorId: await resolverEmpresaConvidante("codigo-invalido") });
    assert.equal((await prisma.empresa.findUniqueOrThrow({ where: { id: convidada } })).convidadaPorId, A);
    assert.equal((await prisma.empresa.findUniqueOrThrow({ where: { id: semConvite } })).convidadaPorId, null);
    assert.equal((await resumo(A, URL_BASE)).total, 1);
    assert.equal((await resumo(B, URL_BASE)).total, 0, "a contagem de outra empresa vazou");
  });

  await teste("9. apagar a empresa que convidou não apaga nem trava a convidada (SET NULL)", async () => {
    await prisma.empresa.delete({ where: { id: A } });
    const c = await prisma.empresa.findUniqueOrThrow({ where: { id: convidada } });
    assert.equal(c.convidadaPorId, null);
  });
}

async function limpar(): Promise<void> {
  await prisma.empresa.deleteMany({ where: { razaoSocial: { startsWith: marca } } });
}

main()
  .catch((e) => {
    resultados.push({ nome: "preparação", ok: false, erro: e instanceof Error ? (e.stack ?? e.message) : String(e) });
  })
  .finally(async () => {
    await limpar().catch((e) => console.error("FALHA NA LIMPEZA — conferir empresas com o marcador", marca, e));
    const sobraram = await prisma.empresa.count({ where: { razaoSocial: { startsWith: marca } } }).catch(() => -1);
    await prisma.$disconnect();
    for (const r of resultados) console.log(`${r.ok ? "ok    " : "FALHOU"} ${r.nome}${r.erro ? `\n         ${r.erro}` : ""}`);
    const falhas = resultados.filter((r) => !r.ok).length;
    console.log(`\n${resultados.length - falhas}/${resultados.length} cenários passaram. Empresas de teste que sobraram: ${sobraram}.`);
    process.exit(falhas === 0 && sobraram === 0 ? 0 : 1);
  });
