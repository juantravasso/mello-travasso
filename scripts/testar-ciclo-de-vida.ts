import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { MAX_TENTATIVAS } from "../src/lib/calendario/config";
import { CONFIG_PADRAO, type ConfigCicloDeVida } from "../src/lib/cicloDeVida/config";
import { avisoDeFimEstaNaJanela, DIA_MS, fimDoDiaLocal } from "../src/lib/cicloDeVida/datas";
import type { MensagemEmail } from "../src/lib/email/enviar.server";
import { agendarBoasVindas, descadastrarPorToken, processarCicloDeVida } from "../src/services/data/server/cicloDeVidaCore.server";
import { estenderTeste, historicoDoTeste } from "../src/services/data/server/extensaoCore.server";

// Teste de integração do ciclo de vida (campanhas, fila de e-mails, avisos de fim do teste, extensão, encerramento,
// descadastro) contra o banco REAL. Nenhum e-mail sai: o envio é substituído por um falso que só guarda as mensagens.
// Cria empresas descartáveis (o nome leva um marcador aleatório), roda tudo restrito a elas (nunca toca em dados reais
// nem na configuração real) e apaga SÓ o que criou.
//
// Rodar: yarn testar:ciclo   (precisa de .env.local com DATABASE_URL)

const prisma = new PrismaClient();
const marca = `ciclo-teste-${randomBytes(3).toString("hex")}`;
const URL_BASE = "https://www.exemplo.com.br";
const T0 = new Date();
const em = (dias: number) => new Date(T0.getTime() + dias * DIA_MS);
const emMin = (min: number) => new Date(T0.getTime() + min * 60_000);

const CONFIG: ConfigCicloDeVida = { ...CONFIG_PADRAO, emails: { ...CONFIG_PADRAO.emails, ativos: true, ativadoEm: em(-30).toISOString() } };

const resultados: { nome: string; ok: boolean; erro?: string }[] = [];
async function teste(nome: string, corpo: () => Promise<void>): Promise<void> {
  try {
    await corpo();
    resultados.push({ nome, ok: true });
  } catch (e) {
    resultados.push({ nome, ok: false, erro: e instanceof Error ? (e.stack ?? e.message) : String(e) });
  }
}

const empresasIds: string[] = [];
const todasAsMensagens: MensagemEmail[] = [];

function enviadorFalso() {
  const enviados: MensagemEmail[] = [];
  let falhando = false;
  return {
    enviados,
    falhar: (v: boolean) => {
      falhando = v;
    },
    enviar: async (m: MensagemEmail) => {
      if (falhando) return false;
      enviados.push(m);
      todasAsMensagens.push(m);
      return true;
    },
  };
}

async function rodar(agora: Date, f: ReturnType<typeof enviadorFalso>, config: ConfigCicloDeVida = CONFIG, somenteEmpresas?: string[]) {
  return processarCicloDeVida({ agora, enviar: f.enviar, urlBase: URL_BASE, config, apenasEmpresas: somenteEmpresas ?? empresasIds, semTetoDiario: true });
}

const iso = (d: Date = new Date()) => d.toISOString();

async function criarEmpresa(sufixo: string, o: { plano?: "teste" | "gratuito" | "ativo"; fim?: Date | null } = {}): Promise<string> {
  const plano = o.plano ?? "teste";
  const e = await prisma.empresa.create({
    data: {
      documento: `${marca}-${sufixo}`,
      razaoSocial: `${marca} ${sufixo}`,
      tipoPessoa: "pj",
      plano,
      testeTerminaEm: plano === "teste" ? iso(o.fim ?? em(10)) : null,
      aceiteTermosVersao: "teste",
      aceiteTermosEm: iso(),
      criadoEm: iso(),
      atualizadoEm: iso(),
    },
  });
  empresasIds.push(e.id);
  return e.id;
}

async function criarDono(empresaId: string, sufixo: string, o: { criadoEm: Date; confirmado?: boolean; promocionais?: boolean }): Promise<{ id: string; email: string; token: string }> {
  const u = await prisma.usuario.create({
    data: {
      empresaId,
      nome: `Dono ${sufixo} ${marca}`,
      email: `${marca}-${sufixo}@example.test`,
      senhaHash: "sem-login",
      papel: "dono",
      emailConfirmadoEm: o.confirmado === false ? null : iso(o.criadoEm),
      emailsPromocionais: o.promocionais ?? true,
      criadoEm: iso(o.criadoEm),
      atualizadoEm: iso(),
    },
  });
  return { id: u.id, email: u.email, token: u.tokenDescadastro };
}

async function criarConta(empresaId: string): Promise<void> {
  const obra = await prisma.obra.create({ data: { empresaId, nome: `Obra ${marca}`, cliente: "Cliente", status: "em_andamento", dataInicio: "2026-01-01", criadoEm: iso(), atualizadoEm: iso() } });
  await prisma.contaFinanceira.create({
    data: {
      empresaId,
      tipo: "pagar",
      obraId: obra.id,
      valor: 100,
      dataLancamento: "2026-10-01",
      dataVencimento: "2026-10-30",
      favorecidoOuCliente: "Fornecedor",
      descricao: "Conta de teste",
      comprovanteUrl: "data:image/png;base64,AAAA",
      criadoEm: iso(),
      atualizadoEm: iso(),
    },
  });
}

const linhas = (usuarioId: string) => prisma.emailAgendado.findMany({ where: { usuarioId }, orderBy: { chave: "asc" } });
const porCampanha = <T extends { campanha: string }>(l: T[], c: string): T[] => l.filter((x) => x.campanha === c);
const eventos = (tipo: string, empresaId: string) => prisma.eventoProduto.count({ where: { tipo, empresaId } });
const notificacoes = (tipo: string, empresaId: string) => prisma.notificacao.count({ where: { tipo, empresaId } });

async function main(): Promise<void> {
  // Os donos são "novos" (cadastro há 1,2 dia): a boas-vindas e a dica de 1 dia estão devidas.
  const recente = em(-1.2);

  await teste("1. cadastro recente: boas-vindas e dica da primeira ação saem uma vez, e repetir não duplica", async () => {
    const e = await criarEmpresa("A");
    const dono = await criarDono(e, "a", { criadoEm: recente });
    const f = enviadorFalso();
    const r1 = await rodar(T0, f);
    assert.equal(r1.emailsAgendados, 2);
    assert.equal(r1.emailsEnviados, 2);
    const r2 = await rodar(emMin(1), f);
    assert.equal(r2.emailsAgendados, 0);
    assert.equal(r2.emailsEnviados, 0);
    assert.equal(f.enviados.length, 2);
    const l = await linhas(dono.id);
    assert.equal(l.length, 2);
    assert.ok(l.every((x) => x.status === "enviado" && x.tentativas === 1));
    assert.ok(f.enviados.every((m) => m.para === dono.email), "e-mail para destinatário errado");
    const promo = f.enviados.find((m) => m.assunto.includes("primeira conta"));
    const trans = f.enviados.find((m) => m.assunto.startsWith("Bem-vindo"));
    assert.ok(promo && trans, "faltou uma das duas mensagens");
    assert.match(promo.texto, /\/capturar/);
    assert.ok(promo.texto.includes(`${URL_BASE}/descadastrar/${dono.token}`), "link de descadastro ausente na promocional");
    assert.ok(promo.cabecalhos?.["List-Unsubscribe"]?.includes(`/api/descadastrar/${dono.token}`));
    assert.equal(promo.cabecalhos?.["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
    assert.equal(trans.cabecalhos, undefined, "a transacional não leva descadastro");
    assert.equal(await eventos("email_enviado", e), 2);
  });

  await teste("2. dois processamentos ao mesmo tempo não duplicam nenhum e-mail", async () => {
    const e = await criarEmpresa("B");
    const dono = await criarDono(e, "b", { criadoEm: recente });
    const f = enviadorFalso();
    await Promise.all([rodar(T0, f), rodar(T0, f), rodar(T0, f)]);
    assert.equal(f.enviados.length, 2, `saíram ${f.enviados.length} mensagens`);
    assert.equal((await linhas(dono.id)).length, 2);
  });

  await teste("3. quem parou de receber dicas não recebe a promocional, mas recebe a boas-vindas e os avisos da conta", async () => {
    const fim = fimDoDiaLocal(em(1));
    const e = await criarEmpresa("C", { fim });
    const dono = await criarDono(e, "c", { criadoEm: recente, promocionais: false });
    const f = enviadorFalso();
    await rodar(T0, f);
    const l = await linhas(dono.id);
    assert.equal(porCampanha(l, "primeira_acao")[0]?.status, "cancelado");
    assert.equal(porCampanha(l, "primeira_acao")[0]?.ultimoErro, "descadastrado");
    assert.equal(porCampanha(l, "boas_vindas")[0]?.status, "enviado");
    const fimEnviados = porCampanha(l, "fim_do_teste").filter((x) => x.status === "enviado");
    assert.ok(fimEnviados.length >= 1, "o aviso de fim do teste (transacional) deveria sair mesmo sem dicas");
    assert.ok(!f.enviados.some((m) => m.assunto.includes("primeira conta")));
  });

  await teste("4. descadastrar por token desliga a preferência, cancela as dicas pendentes e token inválido é recusado", async () => {
    const e = await criarEmpresa("D");
    const dono = await criarDono(e, "d", { criadoEm: em(-20) });
    const iso0 = iso(emMin(-1));
    await prisma.emailAgendado.create({ data: { empresaId: e, usuarioId: dono.id, campanha: "problema", categoria: "promocional", chave: `${dono.id}:problema`, proximaTentativaEm: iso0, criadoEm: iso0, atualizadoEm: iso0 } });
    assert.equal(await descadastrarPorToken("token-que-nao-existe-123"), false);
    assert.equal(await descadastrarPorToken("curto"), false);
    assert.equal(await descadastrarPorToken(dono.token), true);
    assert.equal((await prisma.usuario.findUniqueOrThrow({ where: { id: dono.id } })).emailsPromocionais, false);
    assert.equal((await linhas(dono.id))[0]?.status, "cancelado");
    assert.equal(await descadastrarPorToken(dono.token), true, "repetir o descadastro não pode dar erro");
    assert.equal(await eventos("email_descadastro", e), 1, "o evento de descadastro não pode contar duas vezes");
  });

  await teste("5. a dica da primeira ação não é agendada para quem já lançou uma conta", async () => {
    const e = await criarEmpresa("E");
    const dono = await criarDono(e, "e", { criadoEm: recente });
    await criarConta(e);
    await rodar(T0, enviadorFalso());
    const l = await linhas(dono.id);
    assert.equal(porCampanha(l, "primeira_acao").length, 0);
    assert.equal(porCampanha(l, "boas_vindas").length, 1);
  });

  await teste("6. e-mail já agendado é cancelado na hora de enviar se a pessoa fez a ação nesse meio-tempo", async () => {
    const e = await criarEmpresa("F");
    const dono = await criarDono(e, "f", { criadoEm: recente });
    const iso0 = iso(emMin(-1));
    await prisma.emailAgendado.create({ data: { empresaId: e, usuarioId: dono.id, campanha: "primeira_acao", categoria: "promocional", chave: `${dono.id}:primeira_acao`, proximaTentativaEm: iso0, criadoEm: iso0, atualizadoEm: iso0 } });
    await criarConta(e);
    const f = enviadorFalso();
    await rodar(T0, f, CONFIG, [e]);
    const linha = porCampanha(await linhas(dono.id), "primeira_acao")[0];
    assert.equal(linha?.status, "cancelado");
    assert.equal(linha?.ultimoErro, "já não se aplica");
    assert.ok(!f.enviados.some((m) => m.assunto.includes("primeira conta")));
  });

  await teste("7. falha do provedor: tentativas com espera crescente, até falhar de vez com um evento só", async () => {
    const e = await criarEmpresa("G");
    const dono = await criarDono(e, "g", { criadoEm: em(-0.5) });
    const f = enviadorFalso();
    f.falhar(true);
    // Só a boas-vindas: sem a dica de 1 dia (que também venceria nos passos de 4 h e falharia junto).
    const soBoasVindas: ConfigCicloDeVida = { ...CONFIG, emails: { ...CONFIG.emails, primeiraAcao: { ativa: false, aposDias: 1 } } };
    await rodar(T0, f, soBoasVindas, [e]);
    let l = porCampanha(await linhas(dono.id), "boas_vindas")[0]!;
    assert.equal(l.status, "pendente");
    assert.equal(l.tentativas, 1);
    assert.ok(new Date(l.proximaTentativaEm).getTime() > T0.getTime(), "deveria esperar antes de tentar de novo");
    await rodar(emMin(1), f, soBoasVindas, [e]);
    l = porCampanha(await linhas(dono.id), "boas_vindas")[0]!;
    assert.equal(l.tentativas, 1, "ainda não venceu a espera: não deve tentar");
    for (let passo = 1; passo <= MAX_TENTATIVAS + 2; passo++) await rodar(new Date(T0.getTime() + passo * 4 * 60 * 60_000), f, soBoasVindas, [e]);
    l = porCampanha(await linhas(dono.id), "boas_vindas")[0]!;
    assert.equal(l.status, "falhou");
    assert.equal(l.tentativas, MAX_TENTATIVAS);
    assert.equal(await eventos("email_falhou", e), 1);
    assert.equal(f.enviados.length, 0);
  });

  await teste("8. no máximo uma dica promocional a cada 2 dias: a segunda espera", async () => {
    const e = await criarEmpresa("H");
    const dono = await criarDono(e, "h", { criadoEm: em(-8) });
    const base = T0.getTime();
    for (const [i, campanha] of (["problema", "recursos"] as const).entries()) {
      const quando = new Date(base - (2 - i) * 60_000).toISOString();
      await prisma.emailAgendado.create({ data: { empresaId: e, usuarioId: dono.id, campanha, categoria: "promocional", chave: `${dono.id}:${campanha}`, proximaTentativaEm: quando, criadoEm: quando, atualizadoEm: quando } });
    }
    const f = enviadorFalso();
    await rodar(T0, f, CONFIG, [e]);
    const l = await linhas(dono.id);
    assert.equal(f.enviados.length, 1);
    assert.equal(porCampanha(l, "problema")[0]?.status, "enviado");
    const segunda = porCampanha(l, "recursos")[0]!;
    assert.equal(segunda.status, "pendente");
    assert.equal(segunda.tentativas, 0, "adiar não é falha");
    assert.ok(new Date(segunda.proximaTentativaEm).getTime() >= T0.getTime() + 23 * 60 * 60_000);
  });

  await teste("9. avisos de fim do teste: no app e por e-mail, uma vez por marco, mesmo rodando de novo", async () => {
    const fim = fimDoDiaLocal(em(1));
    const e = await criarEmpresa("I", { fim });
    const dono = await criarDono(e, "i", { criadoEm: em(-20) });
    const esperados = CONFIG.emails.fimDoTeste.diasAntes.filter((d) => avisoDeFimEstaNaJanela(fim, d, T0));
    assert.ok(esperados.length >= 1);
    const f = enviadorFalso();
    const r1 = await rodar(T0, f, CONFIG, [e]);
    assert.equal(r1.avisosNoApp, esperados.length);
    assert.equal(await notificacoes("teste_fim", e), esperados.length);
    assert.equal(porCampanha(await linhas(dono.id), "fim_do_teste").length, esperados.length);
    assert.equal(f.enviados.length, esperados.length);
    assert.ok(f.enviados.every((m) => m.cabecalhos === undefined && /somente para consulta/.test(m.texto)));
    const r2 = await rodar(emMin(3), f, CONFIG, [e]);
    assert.equal(r2.avisosNoApp, 0);
    assert.equal(r2.emailsEnviados, 0);
    assert.equal(await notificacoes("teste_fim", e), esperados.length);
  });

  await teste("10. extensão: soma ao fim, registra quem concedeu e o motivo, avisa a empresa e cancela o aviso do fim antigo", async () => {
    const fimAntigo = fimDoDiaLocal(em(1));
    const e = await criarEmpresa("J", { fim: fimAntigo });
    const dono = await criarDono(e, "j", { criadoEm: em(-20) });
    const iso0 = iso(emMin(-1));
    // Aviso do fim ANTIGO ainda na fila (não saiu): depois da extensão ele seria mentira.
    await prisma.emailAgendado.create({ data: { empresaId: e, usuarioId: dono.id, campanha: "fim_do_teste", categoria: "transacional", chave: `${dono.id}:fim:0:${fimAntigo.toISOString()}`, referencia: fimAntigo.toISOString(), proximaTentativaEm: iso0, criadoEm: iso0, atualizadoEm: iso0 } });

    const r = await estenderTeste({ usuarioId: dono.id }, { empresaId: e, dias: 7, motivo: "Cliente pediu mais tempo para avaliar" }, T0, CONFIG.extensao);
    assert.equal(r.fimAnterior, fimAntigo.toISOString());
    assert.equal(r.fimNovo, fimDoDiaLocal(new Date(fimAntigo.getTime() + 7 * DIA_MS)).toISOString());
    const empresa = await prisma.empresa.findUniqueOrThrow({ where: { id: e } });
    assert.equal(empresa.testeTerminaEm, r.fimNovo);
    assert.equal(empresa.plano, "teste");

    const h = await historicoDoTeste(e);
    assert.equal(h.fimOriginal, fimAntigo.toISOString());
    assert.equal(h.fimAtual, r.fimNovo);
    assert.equal(h.extensoes.length, 1);
    assert.equal(h.extensoes[0]?.dias, 7);
    assert.match(h.extensoes[0]?.motivo ?? "", /mais tempo/);
    assert.match(h.extensoes[0]?.concedidaPor ?? "", /Dono j/);
    assert.equal(await prisma.logAdmin.count({ where: { acao: "empresa.estender_teste", alvoId: e } }), 1);
    assert.equal(await eventos("teste_estendido", e), 1);
    assert.equal(await notificacoes("teste_estendido", e), 1);

    const f = enviadorFalso();
    await rodar(emMin(2), f, CONFIG, [e]);
    const l = await linhas(dono.id);
    assert.equal(porCampanha(l, "fim_do_teste").find((x) => x.referencia === fimAntigo.toISOString())?.status, "cancelado");
    assert.ok(f.enviados.some((m) => m.assunto === "Seu teste foi estendido" && m.texto.includes("7 dia(s)")), "faltou o e-mail de extensão");
    assert.ok(!f.enviados.some((m) => /termina hoje|termina amanhã/.test(m.assunto)), "avisou um fim que já mudou");
  });

  await teste("11. limites da extensão valem no servidor: uma por empresa, só em teste, nunca acima do total", async () => {
    const e = await criarEmpresa("K", { fim: em(5) });
    const dono = await criarDono(e, "k", { criadoEm: em(-20) });
    const admin = { usuarioId: dono.id };
    await assert.rejects(estenderTeste(admin, { empresaId: e, dias: 15, motivo: "acima do limite" }, T0, CONFIG.extensao), /no máximo 14/);
    await assert.rejects(estenderTeste(admin, { empresaId: e, dias: 0, motivo: "zero dias" }, T0, CONFIG.extensao), /1 em diante|inteiro/);
    await estenderTeste(admin, { empresaId: e, dias: 7, motivo: "primeira extensão" }, T0, CONFIG.extensao);
    await assert.rejects(estenderTeste(admin, { empresaId: e, dias: 1, motivo: "segunda extensão" }, T0, CONFIG.extensao), /limite é 1/);
    const ativa = await criarEmpresa("K2", { plano: "ativo" });
    await assert.rejects(estenderTeste(admin, { empresaId: ativa, dias: 3, motivo: "empresa ativa" }, T0, CONFIG.extensao), /não está no plano de teste/);
    const desligada = { ...CONFIG.extensao, ativa: false };
    const outra = await criarEmpresa("K3", { fim: em(5) });
    await assert.rejects(estenderTeste(admin, { empresaId: outra, dias: 3, motivo: "desativada" }, T0, desligada), /desativadas/);
    assert.equal((await prisma.extensaoTeste.count({ where: { empresaId: { in: [e, ativa, outra] } } })), 1);
  });

  await teste("12. duas extensões simultâneas: só uma passa", async () => {
    const e = await criarEmpresa("L", { fim: em(5) });
    const dono = await criarDono(e, "l", { criadoEm: em(-20) });
    const config = { ...CONFIG.extensao, maxExtensoes: 5, maxDiasTotal: 60 };
    const r = await Promise.allSettled(Array.from({ length: 8 }, () => estenderTeste({ usuarioId: dono.id }, { empresaId: e, dias: 7, motivo: "disputa entre admins" }, T0, config)));
    const passaram = r.filter((x) => x.status === "fulfilled").length;
    assert.equal(passaram, 1, `${passaram} extensões passaram`);
    assert.equal(await prisma.extensaoTeste.count({ where: { empresaId: e } }), 1);
  });

  await teste("13. teste vencido: encerramento vira evento e aviso uma vez, e nada é apagado nem rebaixado", async () => {
    const e = await criarEmpresa("M", { fim: new Date(T0.getTime() - 60 * 60_000) });
    await criarDono(e, "m", { criadoEm: em(-20) });
    await criarConta(e);
    const f = enviadorFalso();
    const r1 = await rodar(T0, f, CONFIG, [e]);
    await rodar(emMin(5), f, CONFIG, [e]);
    assert.equal(r1.encerramentos, 1);
    assert.equal(await eventos("teste_encerrado", e), 1);
    assert.equal(await notificacoes("teste_encerrado", e), 1);
    assert.equal(await prisma.contaFinanceira.count({ where: { empresaId: e } }), 1, "os dados do cliente precisam ficar");
    assert.equal((await prisma.empresa.findUniqueOrThrow({ where: { id: e } })).plano, "teste");
  });

  await teste("14. cadastro anterior ao início das campanhas não recebe dicas nem boas-vindas", async () => {
    const e = await criarEmpresa("N");
    const dono = await criarDono(e, "n", { criadoEm: em(-31) });
    const iso0 = iso(emMin(-1));
    await prisma.emailAgendado.create({ data: { empresaId: e, usuarioId: dono.id, campanha: "boas_vindas", categoria: "transacional", chave: `${dono.id}:boas_vindas`, proximaTentativaEm: iso0, criadoEm: iso0, atualizadoEm: iso0 } });
    const f = enviadorFalso();
    await rodar(T0, f, CONFIG, [e]);
    const linha = (await linhas(dono.id))[0];
    assert.equal(linha?.status, "cancelado");
    assert.equal(linha?.ultimoErro, "cadastro anterior ao início das campanhas");
    assert.equal(f.enviados.length, 0);
  });

  await teste("15. e-mail não confirmado: nada sai; depois de confirmar, a boas-vindas sai", async () => {
    const e = await criarEmpresa("O");
    const dono = await criarDono(e, "o", { criadoEm: recente, confirmado: false });
    const f = enviadorFalso();
    const r1 = await rodar(T0, f, CONFIG, [e]);
    assert.equal(r1.emailsAgendados, 0, "campanha não pode ser agendada para endereço não confirmado");
    await agendarBoasVindas(prisma, { id: dono.id, empresaId: e }, T0);
    await agendarBoasVindas(prisma, { id: dono.id, empresaId: e }, T0);
    assert.equal((await linhas(dono.id)).length, 1, "agendar a boas-vindas duas vezes não pode criar duas linhas");
    await rodar(emMin(1), f, CONFIG, [e]);
    assert.equal(f.enviados.length, 0);
    assert.equal((await linhas(dono.id))[0]?.status, "pendente");
    await prisma.usuario.update({ where: { id: dono.id }, data: { emailConfirmadoEm: iso() } });
    await rodar(emMin(61), f, CONFIG, [e]);
    // Confirmado, a dica de 1 dia (devida para um cadastro de 1,2 dia) também passa a valer: o que importa é a boas-vindas.
    assert.ok(f.enviados.some((m) => m.assunto.startsWith("Bem-vindo")), "a boas-vindas deveria ter saído");
    assert.equal(porCampanha(await linhas(dono.id), "boas_vindas")[0]?.status, "enviado");
  });

  await teste("16. chave geral desligada: nada é enviado e nada se perde", async () => {
    const e = await criarEmpresa("P");
    const dono = await criarDono(e, "p", { criadoEm: recente });
    await agendarBoasVindas(prisma, { id: dono.id, empresaId: e }, T0);
    const f = enviadorFalso();
    const desligada: ConfigCicloDeVida = { ...CONFIG, emails: { ...CONFIG.emails, ativos: false } };
    const r = await rodar(T0, f, desligada, [e]);
    assert.equal(r.emailsEnviados, 0);
    assert.equal(r.emailsAgendados, 0);
    const linha = (await linhas(dono.id))[0];
    assert.equal(linha?.status, "pendente");
    assert.equal(linha?.reservadoAte, null, "a reserva precisa ser liberada");
    assert.equal(f.enviados.length, 0);
  });

  await teste("17. empresa que só usa a rede: boas-vindas leva ao perfil e não recebe aviso de fim de teste", async () => {
    const e = await criarEmpresa("Q", { plano: "gratuito" });
    const dono = await criarDono(e, "q", { criadoEm: recente });
    const f = enviadorFalso();
    await rodar(T0, f, CONFIG, [e]);
    const l = await linhas(dono.id);
    assert.equal(porCampanha(l, "fim_do_teste").length, 0);
    const boas = f.enviados.find((m) => m.assunto.startsWith("Bem-vindo"));
    assert.ok(boas?.texto.includes("/minha-rede/perfil"));
    assert.ok(!/dias de teste/.test(boas?.assunto ?? ""));
  });

  await teste("18. nenhuma mensagem de todo o teste saiu para alguém de fora das empresas descartáveis", async () => {
    assert.ok(todasAsMensagens.length > 0);
    assert.ok(todasAsMensagens.every((m) => m.para.startsWith(marca) && m.para.endsWith("@example.test")), "e-mail para destinatário real");
  });
}

async function limpar(): Promise<void> {
  const empresas = await prisma.empresa.findMany({ where: { razaoSocial: { startsWith: marca } }, select: { id: true } });
  const ids = empresas.map((e) => e.id);
  if (ids.length === 0) return;
  const usuarios = await prisma.usuario.findMany({ where: { empresaId: { in: ids } }, select: { id: true } });
  const usuarioIds = usuarios.map((u) => u.id);
  await prisma.$transaction([
    prisma.eventoProduto.deleteMany({ where: { OR: [{ empresaId: { in: ids } }, { usuarioId: { in: usuarioIds } }] } }),
    prisma.logAdmin.deleteMany({ where: { OR: [{ alvoId: { in: ids } }, { adminUsuarioId: { in: usuarioIds } }] } }),
    prisma.rateioConta.deleteMany({ where: { contaFinanceira: { empresaId: { in: ids } } } }),
    prisma.contaFinanceira.deleteMany({ where: { empresaId: { in: ids } } }),
    prisma.obra.deleteMany({ where: { empresaId: { in: ids } } }),
    prisma.notificacao.deleteMany({ where: { empresaId: { in: ids } } }),
    prisma.usuario.deleteMany({ where: { empresaId: { in: ids } } }),
    prisma.empresa.deleteMany({ where: { id: { in: ids } } }),
  ]);
}

main()
  .catch((e) => {
    resultados.push({ nome: "preparação", ok: false, erro: e instanceof Error ? (e.stack ?? e.message) : String(e) });
  })
  .finally(async () => {
    await limpar().catch((e) => console.error("FALHA NA LIMPEZA — conferir empresas com o marcador", marca, e));
    const sobraram = await prisma.empresa.count({ where: { razaoSocial: { startsWith: marca } } }).catch(() => -1);
    const eventosSobrando = await prisma.eventoProduto.count({ where: { empresaId: { in: empresasIds } } }).catch(() => -1);
    await prisma.$disconnect();
    for (const r of resultados) console.log(`${r.ok ? "ok    " : "FALHOU"} ${r.nome}${r.erro ? `\n         ${r.erro}` : ""}`);
    const falhas = resultados.filter((r) => !r.ok).length;
    console.log(`\n${resultados.length - falhas}/${resultados.length} cenários passaram. Empresas de teste que sobraram: ${sobraram}; eventos que sobraram: ${eventosSobrando}.`);
    process.exit(falhas === 0 && sobraram === 0 && eventosSobrando === 0 ? 0 : 1);
  });
