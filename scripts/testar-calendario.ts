import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { dataLocal } from "../src/lib/calendario/tempo";
import type { MensagemEmail } from "../src/lib/email/enviar.server";
import * as core from "../src/services/data/server/calendarioCore.server";
import * as notificacoes from "../src/services/data/server/notificacaoCore.server";
import { processarLembretes, type EnviadorEmail, type EnviadorPush } from "../src/services/data/server/lembretesWorker.server";
import { MAX_TENTATIVAS } from "../src/lib/calendario/config";

// Teste de integração do calendário e dos lembretes contra o banco REAL. Cria duas empresas descartáveis (o nome
// leva um marcador aleatório), exercita as regras e apaga SÓ o que criou. O envio de e-mail é simulado (nada sai);
// o processador roda com relógio simulado e restrito às empresas de teste.
//
// Rodar: yarn testar:calendario   (precisa de .env.local com DATABASE_URL)

const prisma = new PrismaClient();
const marca = `cal-teste-${randomBytes(3).toString("hex")}`;
const SP = "America/Sao_Paulo";
const T0 = new Date();
const DIA = 86_400_000;
const MIN = 60_000;

const resultados: { nome: string; ok: boolean; erro?: string }[] = [];
async function teste(nome: string, corpo: () => Promise<void>): Promise<void> {
  try {
    await corpo();
    resultados.push({ nome, ok: true });
  } catch (e) {
    resultados.push({ nome, ok: false, erro: e instanceof Error ? e.message : String(e) });
  }
}

const dataEm = (dias: number, fuso = SP) => dataLocal(new Date(T0.getTime() + dias * DIA), fuso);
const depois = (d: Date, ms: number) => new Date(d.getTime() + ms);

async function rejeita(promessa: Promise<unknown>, trecho: RegExp): Promise<void> {
  await assert.rejects(promessa, (e: unknown) => e instanceof Error && trecho.test(e.message));
}

interface Pessoa {
  usuarioId: string;
  empresaId: string;
}
async function criarEmpresa(sufixo: string, fuso: string): Promise<string> {
  const iso = new Date().toISOString();
  const e = await prisma.empresa.create({
    data: {
      documento: `${marca}-${sufixo}`,
      razaoSocial: `${marca} ${sufixo}`,
      tipoPessoa: "pj",
      plano: "teste",
      testeTerminaEm: new Date(Date.now() + 20 * DIA).toISOString(),
      fusoHorario: fuso,
      aceiteTermosVersao: "teste",
      aceiteTermosEm: iso,
      criadoEm: iso,
      atualizadoEm: iso,
    },
  });
  return e.id;
}
// Membro usa só os módulos que o dono liberou: por padrão, o Calendário (o dono tem todos, não precisa de lista).
async function criarUsuario(empresaId: string, nome: string, papel: "dono" | "membro", modulos: string[] = ["calendario"]): Promise<Pessoa> {
  const iso = new Date().toISOString();
  const u = await prisma.usuario.create({
    data: { empresaId, nome: `${nome} ${marca}`, email: `${marca}-${nome.toLowerCase()}@example.test`, senhaHash: "sem-login", papel, modulos: papel === "membro" ? modulos : [], emailConfirmadoEm: iso, criadoEm: iso, atualizadoEm: iso },
  });
  return { usuarioId: u.id, empresaId };
}

const base = (extra: Partial<Parameters<typeof core.criar>[1]> = {}) => ({
  titulo: "Reunião de teste",
  categoria: "reuniao",
  data: dataEm(10),
  diaInteiro: false,
  horaInicio: "14:00",
  horaFim: "15:00",
  participantesIds: [] as string[],
  ...extra,
});

async function lembretesDe(id: string) {
  return prisma.lembreteCompromisso.findMany({ where: { compromissoId: id }, orderBy: { tipo: "asc" } });
}
function enviadorOk(caixa: MensagemEmail[]): EnviadorEmail {
  return async (m) => {
    caixa.push(m);
    return true;
  };
}
const enviadorFalho: EnviadorEmail = async () => false;

async function main(): Promise<void> {
  const empA = await criarEmpresa("A", SP);
  const empB = await criarEmpresa("B", "America/Manaus");
  const a1 = await criarUsuario(empA, "Ana", "dono");
  const a2 = await criarUsuario(empA, "Bruno", "membro");
  const a3 = await criarUsuario(empA, "Carla", "membro");
  // Sem o módulo Calendário: não pode ser incluído em compromisso nem aparece na lista de colegas.
  const a4 = await criarUsuario(empA, "Eduardo", "membro", ["estoque"]);
  const b1 = await criarUsuario(empB, "Dino", "dono");
  const escopo = [empA, empB];
  const agoraDe = (c: { id: string }, tipo: "vespera" | "dia") => async () => {
    const l = (await lembretesDe(c.id)).find((x) => x.tipo === tipo);
    assert.ok(l, "lembrete esperado não existe");
    return depois(new Date(l.disparoEm), MIN);
  };

  // 1 ------------------------------------------------------------------------------------------------
  await teste("1. cria compromisso privado: só o criador vê e há 2 lembretes", async () => {
    const c = await core.criar(a1, base({ titulo: "Privado" }), T0);
    assert.equal(c.participantes.length, 0);
    assert.equal(c.souCriador, true);
    const ls = await lembretesDe(c.id);
    assert.deepEqual(ls.map((l) => l.tipo).sort(), ["dia", "vespera"]);
    const periodo = { de: c.data, ate: c.data };
    assert.ok((await core.listarNoPeriodo(a1, periodo.de, periodo.ate, T0)).itens.some((x) => x.id === c.id));
    for (const outro of [a2, a3, b1]) {
      assert.ok(!(await core.listarNoPeriodo(outro, periodo.de, periodo.ate, T0)).itens.some((x) => x.id === c.id), "outro usuário enxergou o compromisso privado");
    }
  });

  // 2 e 4 ---------------------------------------------------------------------------------------------
  const compartilhado = await core.criar(a1, base({ titulo: "Compartilhado", participantesIds: [a2.usuarioId] }), T0);
  await teste("2. cria compromisso compartilhado com usuário da mesma empresa", async () => {
    assert.deepEqual(compartilhado.participantes.map((p) => p.id), [a2.usuarioId]);
    assert.equal(compartilhado.criadoPor.id, a1.usuarioId, "o criador continua identificado");
    const visto = await core.obterUm(a2, compartilhado.id);
    assert.equal(visto.souCriador, false);
  });
  await teste("4. cada compromisso aparece só para quem tem acesso (a empresa sozinha não basta)", async () => {
    const { de, ate } = { de: compartilhado.data, ate: compartilhado.data };
    const ve = async (p: Pessoa) => (await core.listarNoPeriodo(p, de, ate, T0)).itens.some((x) => x.id === compartilhado.id);
    assert.equal(await ve(a1), true);
    assert.equal(await ve(a2), true);
    assert.equal(await ve(a3), false);
    assert.equal(await ve(b1), false);
    await rejeita(core.obterUm(a3, compartilhado.id), /não encontrado/i);
    await rejeita(core.obterUm(b1, compartilhado.id), /não encontrado/i);
  });
  await teste("4b. participante vê mas não altera nem exclui; quem não tem acesso nem descobre que existe", async () => {
    await rejeita(core.atualizar(a2, compartilhado.id, base({ titulo: "Sequestrado" }), T0), /Só quem criou/);
    await rejeita(core.excluir(a2, compartilhado.id), /Só quem criou/);
    await rejeita(core.atualizar(a3, compartilhado.id, base(), T0), /não encontrado/i);
    await rejeita(core.excluir(b1, compartilhado.id), /não encontrado/i);
    assert.equal((await core.obterUm(a1, compartilhado.id)).titulo, "Compartilhado");
  });

  // 3 -------------------------------------------------------------------------------------------------
  await teste("3. impede compartilhar com usuário de outra empresa (criar e editar) e com usuário inativo", async () => {
    await rejeita(core.criar(a1, base({ participantesIds: [b1.usuarioId] }), T0), /usuários ativos da sua empresa/);
    await rejeita(core.atualizar(a1, compartilhado.id, base({ participantesIds: [a2.usuarioId, b1.usuarioId] }), T0), /usuários ativos da sua empresa/);
    await prisma.usuario.update({ where: { id: a3.usuarioId }, data: { desativadoEm: new Date().toISOString() } });
    await rejeita(core.criar(a1, base({ participantesIds: [a3.usuarioId] }), T0), /usuários ativos da sua empresa/);
    await prisma.usuario.update({ where: { id: a3.usuarioId }, data: { desativadoEm: null } });
    // Nada ficou gravado pela tentativa recusada.
    assert.equal(await prisma.compromissoParticipante.count({ where: { usuarioId: b1.usuarioId } }), 0);
    assert.ok(!(await core.listarColegas(a1)).some((c) => c.id === b1.usuarioId), "colega de outra empresa apareceu na lista");
  });
  await teste("3b. lista de colegas traz só usuários ativos da mesma empresa, sem o próprio usuário", async () => {
    const ids = (await core.listarColegas(a1)).map((c) => c.id).sort();
    assert.deepEqual(ids, [a2.usuarioId, a3.usuarioId].sort());
  });

  await teste("3c. quem não tem o módulo Calendário não entra em compromisso e não aparece como colega", async () => {
    await rejeita(core.criar(a1, base({ participantesIds: [a4.usuarioId] }), T0), /módulo Calendário/);
    await rejeita(core.atualizar(a1, compartilhado.id, base({ participantesIds: [a2.usuarioId, a4.usuarioId] }), T0), /módulo Calendário/);
    assert.ok(!(await core.listarColegas(a1)).some((c) => c.id === a4.usuarioId), "colega sem o módulo apareceu na lista");
    assert.equal(await prisma.compromissoParticipante.count({ where: { usuarioId: a4.usuarioId } }), 0);
    // Liberar o módulo passa a valer na hora (lido do banco a cada uso).
    await prisma.usuario.update({ where: { id: a4.usuarioId }, data: { modulos: ["estoque", "calendario"] } });
    assert.ok((await core.listarColegas(a1)).some((c) => c.id === a4.usuarioId), "módulo liberado não refletiu");
    await prisma.usuario.update({ where: { id: a4.usuarioId }, data: { modulos: ["estoque"] } });
  });

  // 5 e 6 ---------------------------------------------------------------------------------------------
  const enviadosE: MensagemEmail[] = [];
  const evento = await core.criar(a1, base({ titulo: "Evento do lembrete", data: dataEm(5), horaInicio: "14:00", horaFim: "15:00", participantesIds: [a2.usuarioId] }), T0);
  await teste("5. envia o lembrete do dia anterior (e-mail e notificação) ao criador e ao participante", async () => {
    const agora = await agoraDe(evento, "vespera")();
    const r = await processarLembretes({ agora, enviar: enviadorOk(enviadosE), apenasEmpresas: escopo });
    assert.ok(r.entregasEnviadas >= 4, `esperava ao menos 4 entregas, veio ${r.entregasEnviadas}`);
    const mensagens = enviadosE.filter((m) => m.assunto.includes("Evento do lembrete"));
    assert.deepEqual(mensagens.map((m) => m.para).sort(), [`${marca}-ana@example.test`, `${marca}-bruno@example.test`].sort());
    assert.ok(mensagens.every((m) => m.assunto.startsWith("Lembrete (amanhã)")));
    assert.ok(mensagens.every((m) => m.html.includes(`/calendario?evento=${evento.id}`)), "e-mail sem o link do compromisso");
    const n1 = await prisma.notificacao.findMany({ where: { compromissoId: evento.id, usuarioId: a1.usuarioId } });
    const n2 = await prisma.notificacao.findMany({ where: { compromissoId: evento.id, usuarioId: a2.usuarioId } });
    assert.equal(n1.length, 1);
    assert.equal(n2.length, 1);
    assert.match(n2[0]?.texto ?? "", /Compartilhado por Ana/);
    assert.equal(await prisma.notificacao.count({ where: { compromissoId: evento.id, usuarioId: a3.usuarioId } }), 0);
    assert.equal(n1[0]?.href, `/calendario?evento=${evento.id}`);
  });
  await teste("6. envia o lembrete do próprio dia", async () => {
    const antes = enviadosE.length;
    const agora = await agoraDe(evento, "dia")();
    await processarLembretes({ agora, enviar: enviadorOk(enviadosE), apenasEmpresas: escopo });
    const novas = enviadosE.slice(antes).filter((m) => m.assunto.includes("Evento do lembrete"));
    assert.equal(novas.length, 2);
    assert.ok(novas.every((m) => m.assunto.startsWith("Lembrete (hoje)")));
    assert.equal(await prisma.notificacao.count({ where: { compromissoId: evento.id, usuarioId: a1.usuarioId } }), 2);
  });
  await teste("9a. reprocessar o mesmo horário não duplica nada", async () => {
    const antes = { emails: enviadosE.length, notif: await prisma.notificacao.count({ where: { compromissoId: evento.id } }) };
    const agora = await agoraDe(evento, "dia")();
    const r = await processarLembretes({ agora, enviar: enviadorOk(enviadosE), apenasEmpresas: escopo });
    assert.equal(enviadosE.length, antes.emails);
    assert.equal(await prisma.notificacao.count({ where: { compromissoId: evento.id } }), antes.notif);
    assert.equal(r.entregasEnviadas, 0);
  });

  // 9 -------------------------------------------------------------------------------------------------
  await teste("9b. dois processadores ao mesmo tempo não duplicam (reserva atômica)", async () => {
    const c = await core.criar(a1, base({ titulo: "Concorrência", data: dataEm(4), participantesIds: [a2.usuarioId] }), T0);
    const caixa: MensagemEmail[] = [];
    const agora = await agoraDe(c, "vespera")();
    await Promise.all([1, 2, 3].map(() => processarLembretes({ agora, enviar: enviadorOk(caixa), apenasEmpresas: escopo })));
    for (const u of [a1, a2]) assert.equal(await prisma.notificacao.count({ where: { compromissoId: c.id, usuarioId: u.usuarioId } }), 1, "notificação duplicada");
    assert.equal(caixa.filter((m) => m.assunto.includes("Concorrência")).length, 2, "e-mail duplicado");
    const entregas = await prisma.entregaLembrete.groupBy({ by: ["usuarioId", "canal"], where: { lembrete: { compromissoId: c.id } }, _count: true });
    assert.ok(entregas.every((g) => g._count === 1), "entrega repetida para o mesmo destinatário e canal");
  });

  // 10 ------------------------------------------------------------------------------------------------
  await teste("10a. falha no e-mail vira nova tentativa com espera; a notificação no app não é afetada", async () => {
    const c = await core.criar(a1, base({ titulo: "Falha de envio", data: dataEm(6) }), T0);
    const agora = await agoraDe(c, "vespera")();
    const r1 = await processarLembretes({ agora, enviar: enviadorFalho, apenasEmpresas: escopo });
    assert.ok(r1.entregasReagendadas >= 1);
    const email = await prisma.entregaLembrete.findFirstOrThrow({ where: { lembrete: { compromissoId: c.id }, canal: "email" } });
    assert.equal(email.status, "pendente");
    assert.equal(email.tentativas, 1);
    assert.ok(email.proximaTentativaEm && new Date(email.proximaTentativaEm) > agora, "nova tentativa precisa ficar no futuro");
    assert.equal(await prisma.notificacao.count({ where: { compromissoId: c.id, usuarioId: a1.usuarioId } }), 1, "a notificação no app deveria ter saído");
    // Ainda não venceu a espera: nada é reenviado.
    const caixa: MensagemEmail[] = [];
    await processarLembretes({ agora: depois(agora, 2 * MIN), enviar: enviadorOk(caixa), apenasEmpresas: escopo });
    assert.equal(caixa.filter((m) => m.assunto.includes("Falha de envio")).length, 0);
    // Passada a espera, a nova tentativa envia uma única vez.
    await processarLembretes({ agora: depois(agora, 6 * MIN), enviar: enviadorOk(caixa), apenasEmpresas: escopo });
    assert.equal(caixa.filter((m) => m.assunto.includes("Falha de envio")).length, 1);
    const depoisDoEnvio = await prisma.entregaLembrete.findUniqueOrThrow({ where: { id: email.id } });
    assert.equal(depoisDoEnvio.status, "enviada");
    assert.equal(await prisma.notificacao.count({ where: { compromissoId: c.id, usuarioId: a1.usuarioId } }), 1, "a nova tentativa do e-mail não pode duplicar a notificação");
  });
  await teste("10b. esgota as tentativas e marca como falha, sem vazar dados no registro", async () => {
    const c = await core.criar(a1, base({ titulo: "Sempre falha", data: dataEm(7) }), T0);
    let agora = await agoraDe(c, "vespera")();
    // Passos de 200 min: cobrem a maior espera entre tentativas (180 min) e terminam bem antes do compromisso.
    for (let i = 0; i < MAX_TENTATIVAS + 2; i++) {
      await processarLembretes({ agora, enviar: enviadorFalho, apenasEmpresas: escopo });
      agora = depois(agora, 200 * MIN);
    }
    const email = await prisma.entregaLembrete.findFirstOrThrow({ where: { lembrete: { compromissoId: c.id }, canal: "email" } });
    assert.equal(email.status, "falhou");
    assert.equal(email.tentativas, MAX_TENTATIVAS);
    assert.ok(email.ultimoErro && !email.ultimoErro.includes("@"), "o motivo da falha não pode conter e-mail");
  });

  await teste("10c. depois que o compromisso passou, a nova tentativa deixa de valer (não avisa do que já aconteceu)", async () => {
    const c = await core.criar(a1, base({ titulo: "Já passou", data: dataEm(7) }), T0);
    const agora = await agoraDe(c, "vespera")();
    await processarLembretes({ agora, enviar: enviadorFalho, apenasEmpresas: escopo });
    const caixa: MensagemEmail[] = [];
    await processarLembretes({ agora: depois(agora, 3 * DIA), enviar: enviadorOk(caixa), apenasEmpresas: escopo });
    assert.equal(caixa.filter((m) => m.assunto.includes("Já passou")).length, 0);
    const email = await prisma.entregaLembrete.findFirstOrThrow({ where: { lembrete: { compromissoId: c.id }, canal: "email" } });
    assert.equal(email.status, "ignorada");
  });

  // 7 -------------------------------------------------------------------------------------------------
  await teste("7a. cancelar o compromisso cancela os lembretes pendentes; reativar volta a agendar", async () => {
    const c = await core.criar(a1, base({ titulo: "Será cancelado", data: dataEm(8) }), T0);
    await core.atualizar(a1, c.id, base({ titulo: "Será cancelado", data: dataEm(8), status: "cancelado" }), T0);
    assert.ok((await lembretesDe(c.id)).every((l) => l.status === "ignorado"));
    const caixa: MensagemEmail[] = [];
    await processarLembretes({ agora: depois(T0, 30 * DIA), enviar: enviadorOk(caixa), apenasEmpresas: escopo });
    assert.equal(caixa.filter((m) => m.assunto.includes("Será cancelado")).length, 0);
    assert.equal(await prisma.notificacao.count({ where: { compromissoId: c.id } }), 0);
    await core.atualizar(a1, c.id, base({ titulo: "Será cancelado", data: dataEm(8), status: "agendado" }), T0);
    const ls = await lembretesDe(c.id);
    assert.ok(ls.every((l) => l.status === "pendente" && l.versao === 2));
  });
  await teste("7b. concluir antes do envio impede o lembrete", async () => {
    const c = await core.criar(a1, base({ titulo: "Já concluído", data: dataEm(8) }), T0);
    await core.atualizar(a1, c.id, base({ titulo: "Já concluído", data: dataEm(8), status: "concluido" }), T0);
    const caixa: MensagemEmail[] = [];
    await processarLembretes({ agora: depois(T0, 30 * DIA), enviar: enviadorOk(caixa), apenasEmpresas: escopo });
    assert.equal(caixa.filter((m) => m.assunto.includes("Já concluído")).length, 0);
  });
  await teste("7c. cancelar depois que as entregas existem ignora as que estavam à espera de nova tentativa", async () => {
    const c = await core.criar(a1, base({ titulo: "Cancela no meio", data: dataEm(9) }), T0);
    const agora = await agoraDe(c, "vespera")();
    await processarLembretes({ agora, enviar: enviadorFalho, apenasEmpresas: escopo });
    await core.atualizar(a1, c.id, base({ titulo: "Cancela no meio", data: dataEm(9), status: "cancelado" }), T0);
    const caixa: MensagemEmail[] = [];
    await processarLembretes({ agora: depois(agora, 8 * 60 * MIN), enviar: enviadorOk(caixa), apenasEmpresas: escopo });
    assert.equal(caixa.filter((m) => m.assunto.includes("Cancela no meio")).length, 0);
    const email = await prisma.entregaLembrete.findFirstOrThrow({ where: { lembrete: { compromissoId: c.id }, canal: "email" } });
    assert.equal(email.status, "ignorada");
  });
  await teste("7d. excluir remove lembretes e entregas e mantém a notificação já recebida, sem vínculo", async () => {
    const c = await core.criar(a1, base({ titulo: "Será excluído", data: dataEm(8) }), T0);
    await processarLembretes({ agora: await agoraDe(c, "vespera")(), enviar: enviadorOk([]), apenasEmpresas: escopo });
    assert.equal(await prisma.notificacao.count({ where: { compromissoId: c.id } }), 1);
    await core.excluir(a1, c.id);
    assert.equal((await lembretesDe(c.id)).length, 0);
    assert.equal(await prisma.entregaLembrete.count({ where: { lembrete: { compromissoId: c.id } } }), 0);
    const restante = await prisma.notificacao.findFirst({ where: { usuarioId: a1.usuarioId, titulo: { contains: "Será excluído" } } });
    assert.ok(restante && restante.compromissoId === null);
    await rejeita(core.obterUm(a1, c.id), /não encontrado/i);
  });

  // 8 -------------------------------------------------------------------------------------------------
  await teste("8. alterar data ou horário recalcula os lembretes; editar outra coisa não mexe", async () => {
    const c = await core.criar(a1, base({ titulo: "Recalcular", data: dataEm(12) }), T0);
    const antes = await lembretesDe(c.id);
    await core.atualizar(a1, c.id, base({ titulo: "Recalcular com outro título", data: dataEm(12) }), T0);
    const igual = await lembretesDe(c.id);
    assert.deepEqual(igual.map((l) => [l.disparoEm, l.versao]), antes.map((l) => [l.disparoEm, l.versao]));
    await core.atualizar(a1, c.id, base({ titulo: "Recalcular", data: dataEm(15), horaInicio: "16:30", horaFim: "17:00" }), T0);
    const novo = await lembretesDe(c.id);
    for (const l of novo) {
      const velho = antes.find((x) => x.tipo === l.tipo);
      assert.notEqual(l.disparoEm, velho?.disparoEm);
      assert.equal(l.versao, 2);
      assert.equal(l.status, "pendente");
    }
    const v = novo.find((l) => l.tipo === "vespera");
    const inicio = (await prisma.compromisso.findUniqueOrThrow({ where: { id: c.id } })).inicioEm;
    assert.equal(new Date(v?.disparoEm ?? "").getTime(), new Date(inicio).getTime() - DIA);
    // Movido para o passado: os lembretes pendentes deixam de valer.
    await core.atualizar(a1, c.id, base({ titulo: "Recalcular", data: dataEm(-2) }), T0);
    assert.ok((await lembretesDe(c.id)).every((l) => l.status === "ignorado"));
  });
  await teste("8b. remarcar um compromisso que já tinha avisado permite avisar de novo (uma vez por versão)", async () => {
    const c = await core.criar(a1, base({ titulo: "Remarcado", data: dataEm(11) }), T0);
    await processarLembretes({ agora: await agoraDe(c, "vespera")(), enviar: enviadorOk([]), apenasEmpresas: escopo });
    assert.equal(await prisma.notificacao.count({ where: { compromissoId: c.id, usuarioId: a1.usuarioId } }), 1);
    await core.atualizar(a1, c.id, base({ titulo: "Remarcado", data: dataEm(13) }), T0);
    const agora = await agoraDe(c, "vespera")();
    await processarLembretes({ agora, enviar: enviadorOk([]), apenasEmpresas: escopo });
    await processarLembretes({ agora, enviar: enviadorOk([]), apenasEmpresas: escopo });
    assert.equal(await prisma.notificacao.count({ where: { compromissoId: c.id, usuarioId: a1.usuarioId } }), 2);
  });
  await teste("8c. criado depois da hora de um lembrete: só os que ainda estão no futuro (sem aviso retroativo)", async () => {
    const amanha = dataEm(1);
    const c = await core.criar(a1, base({ titulo: "Em cima da hora", data: amanha, horaInicio: "23:00", horaFim: undefined }), T0);
    const ls = await lembretesDe(c.id);
    // A véspera seria 23:00 de hoje (SP); só entra se ainda não passou.
    const vespera = ls.find((l) => l.tipo === "vespera");
    if (vespera) assert.ok(new Date(vespera.disparoEm) > T0);
    for (const l of ls) assert.ok(new Date(l.disparoEm) > T0, "lembrete retroativo foi agendado");
  });

  // 11 ------------------------------------------------------------------------------------------------
  await teste("11. cada usuário vê só as próprias notificações; a da empresa vale para todos dela", async () => {
    const empresaWide = await prisma.notificacao.create({
      data: { empresaId: empA, usuarioId: null, tipo: "teste", texto: "aviso da empresa", href: "/dashboard", criadoEm: new Date().toISOString() },
    });
    const lista = async (p: Pessoa) => (await notificacoes.listar(p)).map((n) => n.id);
    const doA1 = await prisma.notificacao.findFirstOrThrow({ where: { usuarioId: a1.usuarioId, compromissoId: evento.id } });
    const doA2 = await prisma.notificacao.findFirstOrThrow({ where: { usuarioId: a2.usuarioId, compromissoId: evento.id } });
    const [l1, l2, l3, lb] = await Promise.all([lista(a1), lista(a2), lista(a3), lista(b1)]);
    assert.ok(l1.includes(doA1.id) && !l1.includes(doA2.id), "A1 viu notificação de A2");
    assert.ok(l2.includes(doA2.id) && !l2.includes(doA1.id), "A2 viu notificação de A1");
    assert.ok(!l3.includes(doA1.id) && !l3.includes(doA2.id), "A3 viu notificação alheia");
    assert.ok(!lb.includes(doA1.id) && !lb.includes(empresaWide.id), "usuário de outra empresa viu notificação");
    assert.ok(l1.includes(empresaWide.id) && l2.includes(empresaWide.id) && l3.includes(empresaWide.id), "notificação da empresa não chegou a todos");
    // Tentar marcar a notificação de outro como lida (identificador adivinhado) não faz nada.
    await notificacoes.marcarLida(a2, doA1.id);
    await notificacoes.marcarLida(b1, doA1.id);
    assert.equal((await prisma.notificacao.findUniqueOrThrow({ where: { id: doA1.id } })).lida, false);
    // Marcar todas como lidas alcança as do próprio usuário (a da empresa é compartilhada por desenho, então fica de fora da conta).
    const individuaisNaoLidas = (p: Pessoa) => prisma.notificacao.count({ where: { usuarioId: p.usuarioId, lida: false } });
    const naoLidasA1 = await individuaisNaoLidas(a1);
    assert.ok(naoLidasA1 >= 1);
    await notificacoes.marcarTodasLidas(a2);
    assert.equal(await individuaisNaoLidas(a1), naoLidasA1, "A2 marcou como lidas as notificações de A1");
    assert.equal(await individuaisNaoLidas(a2), 0);
    assert.equal(await notificacoes.contarNaoLidas(a3), 0, "A3 só teria a notificação da empresa, que A2 acabou de marcar");
    await notificacoes.marcarLida(a1, doA1.id);
    assert.equal((await prisma.notificacao.findUniqueOrThrow({ where: { id: doA1.id } })).lida, true);
    assert.equal(await notificacoes.contarNaoLidas(b1), 0);
  });

  // 2c ------------------------------------------------------------------------------------------------
  await teste("2c. tirar alguém do compartilhamento remove o acesso e os avisos dele", async () => {
    assert.ok(await prisma.notificacao.count({ where: { compromissoId: evento.id, usuarioId: a2.usuarioId } }) > 0);
    await core.atualizar(a1, evento.id, base({ titulo: "Evento do lembrete", data: evento.data, participantesIds: [] }), T0);
    await rejeita(core.obterUm(a2, evento.id), /não encontrado/i);
    assert.equal(await prisma.notificacao.count({ where: { compromissoId: evento.id, usuarioId: a2.usuarioId } }), 0);
    assert.ok(!(await core.listarNoPeriodo(a2, evento.data, evento.data, T0)).itens.some((x) => x.id === evento.id));
    assert.ok((await core.obterUm(a1, evento.id)).participantes.length === 0);
  });
  await teste("2d. alteração do criador reflete para quem tem acesso", async () => {
    const c = await core.criar(a1, base({ titulo: "Antes", participantesIds: [a2.usuarioId] }), T0);
    await core.atualizar(a1, c.id, base({ titulo: "Depois", participantesIds: [a2.usuarioId], horaInicio: "09:00", horaFim: "09:30" }), T0);
    const visto = await core.obterUm(a2, c.id);
    assert.equal(visto.titulo, "Depois");
    assert.equal(visto.horaInicio, "09:00");
  });

  // 12 ------------------------------------------------------------------------------------------------
  await teste("12. fuso da empresa e dia inteiro", async () => {
    const dB = dataEm(10, "America/Manaus");
    const cb = await core.criar(b1, { ...base({ titulo: "Manaus", data: dB, horaInicio: "10:00", horaFim: undefined }) }, T0);
    const regB = await prisma.compromisso.findUniqueOrThrow({ where: { id: cb.id } });
    assert.equal(regB.fuso, "America/Manaus");
    assert.equal(regB.inicioEm, `${dB}T14:00:00.000Z`, "10:00 em Manaus são 14:00 UTC");

    const dia = dataEm(10);
    const ca = await core.criar(a1, { titulo: "Dia inteiro", categoria: "prazo", data: dia, diaInteiro: true, participantesIds: [] }, T0);
    const regA = await prisma.compromisso.findUniqueOrThrow({ where: { id: ca.id } });
    assert.equal(regA.horaInicio, null);
    assert.equal(regA.inicioEm, `${dia}T03:00:00.000Z`, "meia-noite de Brasília");
    const ls = await lembretesDe(ca.id);
    const prev = new Date(`${dia}T12:00:00.000Z`);
    assert.equal(ls.find((l) => l.tipo === "dia")?.disparoEm, prev.toISOString(), "9h de Brasília no dia");
    assert.equal(ls.find((l) => l.tipo === "vespera")?.disparoEm, new Date(prev.getTime() - DIA).toISOString(), "9h de Brasília na véspera");
  });
  await teste("12b. a data de hoje na listagem vem do fuso da empresa, não do servidor", async () => {
    const instante = new Date("2026-10-21T01:30:00.000Z"); // ainda 20/10 em Brasília e em Manaus
    assert.equal((await core.listarNoPeriodo(a1, "2026-10-20", "2026-10-20", instante)).hoje, "2026-10-20");
    assert.equal(await core.hojeDaEmpresa(b1, new Date("2026-10-21T03:30:00.000Z")), "2026-10-20"); // 23:30 em Manaus
    assert.equal(await core.hojeDaEmpresa(a1, new Date("2026-10-21T03:30:00.000Z")), "2026-10-21"); // 00:30 em Brasília
  });

  // Entradas inválidas -----------------------------------------------------------------------------
  await teste("validação no servidor: horário inválido, título vazio e campos forjados são recusados", async () => {
    await rejeita(core.criar(a1, base({ horaInicio: "15:00", horaFim: "14:00" }), T0), /O término precisa ser depois do início/);
    await rejeita(core.criar(a1, base({ titulo: "  " }), T0), /Informe o título/);
    await rejeita(core.criar(a1, { ...base(), empresaId: empB }, T0), /./);
    await rejeita(core.criar(a1, { ...base(), criadoPorId: a2.usuarioId }, T0), /./);
  });

  // Push -------------------------------------------------------------------------------------------------
  await teste("push: só quem tem aparelho inscrito recebe; aparelho expirado é apagado; falha temporária reagenda", async () => {
    const antes = { pub: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, priv: process.env.VAPID_PRIVATE_KEY };
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "chave-publica-de-teste";
    process.env.VAPID_PRIVATE_KEY = "chave-privada-de-teste";
    try {
      const iso = new Date().toISOString();
      await prisma.inscricaoPush.createMany({
        data: [
          { usuarioId: a1.usuarioId, endpoint: `https://push.example.test/${marca}/ana`, p256dh: "p", auth: "a", criadoEm: iso },
          { usuarioId: a2.usuarioId, endpoint: `https://push.example.test/${marca}/bruno`, p256dh: "p", auth: "a", criadoEm: iso },
        ],
      });
      const c = await core.criar(a1, base({ titulo: "Evento com push", data: dataEm(6), participantesIds: [a2.usuarioId] }), T0);
      const agora = await agoraDe(c, "vespera")();
      const enviados: string[] = [];
      const push: EnviadorPush = async (inscricao, payload) => {
        // O processador também pega entregas de outros compromissos do teste: só o deste interessa.
        if (payload.href !== `/calendario?evento=${c.id}`) return "ok";
        enviados.push(inscricao.endpoint);
        return inscricao.endpoint.endsWith("/bruno") ? "expirada" : "ok";
      };
      await processarLembretes({ agora, enviar: enviadorOk([]), enviarPush: push, apenasEmpresas: escopo });
      assert.deepEqual(enviados.sort(), [`https://push.example.test/${marca}/ana`, `https://push.example.test/${marca}/bruno`].sort());
      assert.equal(await prisma.inscricaoPush.count({ where: { usuarioId: a2.usuarioId } }), 0, "aparelho expirado não foi apagado");
      assert.equal(await prisma.inscricaoPush.count({ where: { usuarioId: a1.usuarioId } }), 1);
      const entregas = await prisma.entregaLembrete.findMany({ where: { canal: "push", lembrete: { compromissoId: c.id } } });
      assert.deepEqual(entregas.map((e) => e.status).sort(), ["enviada", "ignorada"]);

      // Reprocessar não envia de novo.
      enviados.length = 0;
      await processarLembretes({ agora, enviar: enviadorOk([]), enviarPush: push, apenasEmpresas: escopo });
      assert.equal(enviados.length, 0);

      // Falha temporária: a entrega fica pendente para uma nova tentativa.
      const c2 = await core.criar(a1, base({ titulo: "Push que falha", data: dataEm(7) }), T0);
      const falha: EnviadorPush = async () => "falha";
      await processarLembretes({ agora: await agoraDe(c2, "vespera")(), enviar: enviadorOk([]), enviarPush: falha, apenasEmpresas: escopo });
      const pendente = await prisma.entregaLembrete.findFirst({ where: { canal: "push", lembrete: { compromissoId: c2.id } } });
      assert.equal(pendente?.status, "pendente");
      assert.equal(pendente?.tentativas, 1);
      assert.ok(await prisma.inscricaoPush.findFirst({ where: { usuarioId: a1.usuarioId } }), "falha temporária não pode apagar o aparelho");

      // Com o recurso desligado no servidor, nenhuma entrega de push nasce.
      delete process.env.VAPID_PRIVATE_KEY;
      const c3 = await core.criar(a1, base({ titulo: "Sem push", data: dataEm(8) }), T0);
      await processarLembretes({ agora: await agoraDe(c3, "vespera")(), enviar: enviadorOk([]), enviarPush: push, apenasEmpresas: escopo });
      assert.equal(await prisma.entregaLembrete.count({ where: { canal: "push", lembrete: { compromissoId: c3.id } } }), 0);
    } finally {
      if (antes.pub === undefined) delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      else process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = antes.pub;
      if (antes.priv === undefined) delete process.env.VAPID_PRIVATE_KEY;
      else process.env.VAPID_PRIVATE_KEY = antes.priv;
    }
  });
}

async function limpar(): Promise<void> {
  const empresas = await prisma.empresa.findMany({ where: { razaoSocial: { startsWith: marca } }, select: { id: true } });
  const ids = empresas.map((e) => e.id);
  if (ids.length === 0) return;
  await prisma.$transaction([
    prisma.compromisso.deleteMany({ where: { empresaId: { in: ids } } }),
    prisma.notificacao.deleteMany({ where: { empresaId: { in: ids } } }),
    prisma.usuario.deleteMany({ where: { empresaId: { in: ids } } }),
    prisma.empresa.deleteMany({ where: { id: { in: ids } } }),
  ]);
}

main()
  .catch((e) => {
    resultados.push({ nome: "preparação", ok: false, erro: e instanceof Error ? e.stack ?? e.message : String(e) });
  })
  .finally(async () => {
    await limpar().catch((e) => console.error("FALHA NA LIMPEZA — conferir empresas com o marcador", marca, e));
    await prisma.$disconnect();
    for (const r of resultados) console.log(`${r.ok ? "ok    " : "FALHOU"} ${r.nome}${r.erro ? `\n         ${r.erro}` : ""}`);
    const falhas = resultados.filter((r) => !r.ok).length;
    console.log(`\n${resultados.length - falhas}/${resultados.length} cenários passaram.`);
    process.exit(falhas === 0 ? 0 : 1);
  });
