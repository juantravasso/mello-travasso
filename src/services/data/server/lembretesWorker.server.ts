import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { enviarEmail, type MensagemEmail } from "@/lib/email/enviar.server";
import { ESPERA_ENTRE_TENTATIVAS_MIN, MAX_TENTATIVAS } from "@/lib/calendario/config";
import { montarEmailLembrete, textoNotificacao, type DadosLembrete } from "@/lib/calendario/emailLembrete";
import { aindaFazSentidoAvisar } from "@/lib/calendario/lembretes";
import { urlDoSite } from "@/lib/rede/site";

// Processamento dos lembretes agendados. Quem dispara (GitHub Actions, cron) só chama processarLembretes(): ela
// é idempotente e segura para rodar em paralelo.
//
// Duas fases:
//  1. Lembretes que já venceram viram ENTREGAS (uma por destinatário e canal). A unicidade
//     (lembrete, versão, usuário, canal) impede duplicar mesmo se a fase rodar duas vezes ou em dois processos.
//  2. Cada entrega é enviada. O app grava a notificação na mesma transação que marca "enviada"; o e-mail usa a
//     chave de idempotência do provedor. Falha vira nova tentativa com espera crescente, até um limite.
//
// Cada item é reservado com um UPDATE condicional (só vence quem altera uma linha) e a reserva expira sozinha,
// então uma queda no meio não deixa nada preso.

const RESERVA_MS = 5 * 60 * 1000;
const MS_MINUTO = 60_000;

export type EnviadorEmail = (mensagem: MensagemEmail) => Promise<boolean>;

export interface OpcoesProcessamento {
  agora?: Date;
  /** Substituível em teste; em produção é o envio real (Resend). */
  enviar?: EnviadorEmail;
  limiteLembretes?: number;
  limiteEntregas?: number;
  /** Restringe a estas empresas. Só os testes usam (relógio simulado não pode tocar em dados reais). */
  apenasEmpresas?: string[];
}

export interface ResultadoProcessamento {
  lembretesProcessados: number;
  lembretesIgnorados: number;
  entregasEnviadas: number;
  entregasReagendadas: number;
  entregasFalhas: number;
  entregasIgnoradas: number;
}

const selecaoUsuario = {
  id: true,
  nome: true,
  email: true,
  lembretesPorEmail: true,
  lembretesNoApp: true,
  desativadoEm: true,
  bloqueadoPlataformaEm: true,
} satisfies Prisma.UsuarioSelect;

const incluirParaEntrega = {
  criadoPor: { select: selecaoUsuario },
  participantes: { select: { usuario: { select: selecaoUsuario } } },
  empresa: { select: { bloqueadaEm: true } },
} satisfies Prisma.CompromissoInclude;

type CompromissoCompleto = Prisma.CompromissoGetPayload<{ include: typeof incluirParaEntrega }>;
type UsuarioDestino = Prisma.UsuarioGetPayload<{ select: typeof selecaoUsuario }>;

function ativo(u: UsuarioDestino): boolean {
  return u.desativadoEm === null && u.bloqueadoPlataformaEm === null;
}

function dadosDoLembrete(c: CompromissoCompleto, tipo: "vespera" | "dia", destino: UsuarioDestino): DadosLembrete {
  return {
    tipo,
    titulo: c.titulo,
    descricao: c.descricao,
    data: c.data,
    diaInteiro: c.diaInteiro,
    horaInicio: c.horaInicio,
    horaFim: c.horaFim,
    criadoPorNome: c.criadoPor.nome,
    compartilhado: c.criadoPorId !== destino.id,
  };
}

function maisMinutos(base: Date, minutos: number): string {
  return new Date(base.getTime() + minutos * MS_MINUTO).toISOString();
}

// --- Fase 1: lembretes vencidos viram entregas ---------------------------------

async function materializarLembretes(agora: Date, limite: number, r: ResultadoProcessamento, empresas?: string[]): Promise<void> {
  const iso = agora.toISOString();
  const devidos = await prisma.lembreteCompromisso.findMany({
    where: {
      OR: [{ status: "pendente", disparoEm: { lte: iso } }, { status: "processando", travadoAte: { lt: iso } }],
      ...(empresas ? { compromisso: { empresaId: { in: empresas } } } : {}),
    },
    orderBy: [{ disparoEm: "asc" }, { id: "asc" }],
    take: limite,
    select: { id: true, versao: true, compromissoId: true },
  });

  for (const devido of devidos) {
    // Reserva: só um processamento consegue mudar a linha de "pendente" (ou reserva vencida) para "processando".
    const reservado = await prisma.lembreteCompromisso.updateMany({
      where: {
        id: devido.id,
        versao: devido.versao,
        OR: [{ status: "pendente" }, { status: "processando", travadoAte: { lt: iso } }],
      },
      data: { status: "processando", travadoAte: maisMinutos(agora, RESERVA_MS / MS_MINUTO), atualizadoEm: iso },
    });
    if (reservado.count !== 1) continue;

    const c = await prisma.compromisso.findUnique({ where: { id: devido.compromissoId }, include: incluirParaEntrega });
    if (!c || c.empresa.bloqueadaEm || !aindaFazSentidoAvisar(c, agora)) {
      await prisma.lembreteCompromisso.updateMany({
        where: { id: devido.id, versao: devido.versao },
        data: { status: "ignorado", travadoAte: null, atualizadoEm: iso },
      });
      r.lembretesIgnorados++;
      continue;
    }

    const destinos = [c.criadoPor, ...c.participantes.map((p) => p.usuario)].filter(ativo);
    const entregas: Prisma.EntregaLembreteCreateManyInput[] = [];
    for (const u of destinos) {
      if (u.lembretesNoApp) entregas.push({ lembreteId: devido.id, versao: devido.versao, usuarioId: u.id, canal: "app", criadoEm: iso, atualizadoEm: iso });
      if (u.lembretesPorEmail) entregas.push({ lembreteId: devido.id, versao: devido.versao, usuarioId: u.id, canal: "email", criadoEm: iso, atualizadoEm: iso });
    }
    // skipDuplicates + unicidade: repetir esta etapa não cria nada de novo.
    if (entregas.length > 0) await prisma.entregaLembrete.createMany({ data: entregas, skipDuplicates: true });
    await prisma.lembreteCompromisso.updateMany({
      where: { id: devido.id, versao: devido.versao },
      data: { status: "processado", processadoEm: iso, travadoAte: null, atualizadoEm: iso },
    });
    r.lembretesProcessados++;
  }
}

// --- Fase 2: envio de cada entrega -----------------------------------------------

async function ignorarEntrega(id: string, iso: string, r: ResultadoProcessamento): Promise<void> {
  await prisma.entregaLembrete.updateMany({ where: { id, status: "pendente" }, data: { status: "ignorada", travadoAte: null, atualizadoEm: iso } });
  r.entregasIgnoradas++;
}

async function registrarFalha(entrega: { id: string; tentativas: number }, agora: Date, motivo: string, r: ResultadoProcessamento): Promise<void> {
  const tentativas = entrega.tentativas + 1;
  const iso = agora.toISOString();
  if (tentativas >= MAX_TENTATIVAS) {
    await prisma.entregaLembrete.updateMany({
      where: { id: entrega.id, status: "pendente" },
      data: { status: "falhou", tentativas, ultimoErro: motivo, travadoAte: null, proximaTentativaEm: null, atualizadoEm: iso },
    });
    r.entregasFalhas++;
    return;
  }
  const espera = ESPERA_ENTRE_TENTATIVAS_MIN[tentativas - 1] ?? ESPERA_ENTRE_TENTATIVAS_MIN[ESPERA_ENTRE_TENTATIVAS_MIN.length - 1] ?? 60;
  await prisma.entregaLembrete.updateMany({
    where: { id: entrega.id, status: "pendente" },
    data: { tentativas, ultimoErro: motivo, travadoAte: null, proximaTentativaEm: maisMinutos(agora, espera), atualizadoEm: iso },
  });
  r.entregasReagendadas++;
}

async function enviarEntregas(agora: Date, limite: number, enviar: EnviadorEmail, r: ResultadoProcessamento, empresas?: string[]): Promise<void> {
  const iso = agora.toISOString();
  const candidatas = await prisma.entregaLembrete.findMany({
    where: {
      status: "pendente",
      ...(empresas ? { lembrete: { compromisso: { empresaId: { in: empresas } } } } : {}),
      AND: [{ OR: [{ proximaTentativaEm: null }, { proximaTentativaEm: { lte: iso } }] }, { OR: [{ travadoAte: null }, { travadoAte: { lt: iso } }] }],
    },
    orderBy: [{ criadoEm: "asc" }, { id: "asc" }],
    take: limite,
    include: { lembrete: { select: { tipo: true, versao: true, compromissoId: true } } },
  });

  for (const entrega of candidatas) {
    const reservada = await prisma.entregaLembrete.updateMany({
      where: { id: entrega.id, status: "pendente", OR: [{ travadoAte: null }, { travadoAte: { lt: iso } }] },
      data: { travadoAte: maisMinutos(agora, RESERVA_MS / MS_MINUTO), atualizadoEm: iso },
    });
    if (reservada.count !== 1) continue;

    try {
      const c = await prisma.compromisso.findUnique({ where: { id: entrega.lembrete.compromissoId }, include: incluirParaEntrega });
      const destino = c ? [c.criadoPor, ...c.participantes.map((p) => p.usuario)].find((u) => u.id === entrega.usuarioId) : undefined;
      const preferencia = destino ? (entrega.canal === "email" ? destino.lembretesPorEmail : destino.lembretesNoApp) : false;
      // Versão antiga (compromisso remarcado), cancelado, concluído, encerrado, ou destinatário que saiu/desligou o canal.
      if (!c || !destino || !ativo(destino) || !preferencia || c.empresa.bloqueadaEm || entrega.versao !== entrega.lembrete.versao || !aindaFazSentidoAvisar(c, agora)) {
        await ignorarEntrega(entrega.id, iso, r);
        continue;
      }
      const dados = dadosDoLembrete(c, entrega.lembrete.tipo, destino);
      const link = `${urlDoSite()}/calendario?evento=${c.id}`;

      if (entrega.canal === "app") {
        const texto = textoNotificacao(dados);
        // Marcar como enviada e gravar a notificação são um só passo: ou os dois, ou nenhum, e só um vence.
        const gravou = await prisma.$transaction(async (tx) => {
          const marcada = await tx.entregaLembrete.updateMany({
            where: { id: entrega.id, status: "pendente" },
            data: { status: "enviada", enviadoEm: iso, travadoAte: null, proximaTentativaEm: null, ultimoErro: null, atualizadoEm: iso },
          });
          if (marcada.count !== 1) return false;
          await tx.notificacao.create({
            data: {
              empresaId: c.empresaId,
              usuarioId: destino.id,
              compromissoId: c.id,
              tipo: "lembrete_compromisso",
              titulo: texto.titulo,
              texto: texto.texto,
              href: `/calendario?evento=${c.id}`,
              criadoEm: iso,
            },
          });
          return true;
        });
        if (gravou) r.entregasEnviadas++;
        continue;
      }

      const mensagem = montarEmailLembrete({ ...dados, link });
      // A chave de idempotência (a entrega) faz o provedor descartar um reenvio causado por queda entre o envio e o registro.
      const aceito = await enviar({ para: destino.email, ...mensagem, chaveIdempotencia: `lembrete-${entrega.id}` });
      if (!aceito) {
        await registrarFalha(entrega, agora, "provedor de e-mail recusou ou está indisponível", r);
        continue;
      }
      const marcada = await prisma.entregaLembrete.updateMany({
        where: { id: entrega.id, status: "pendente" },
        data: { status: "enviada", enviadoEm: iso, travadoAte: null, proximaTentativaEm: null, ultimoErro: null, atualizadoEm: iso },
      });
      if (marcada.count === 1) r.entregasEnviadas++;
    } catch (erro) {
      // Só o tipo do erro: nada de e-mail, token ou corpo da mensagem em log.
      console.error("[calendario] falha ao enviar lembrete:", erro instanceof Error ? erro.name : "erro");
      await registrarFalha(entrega, agora, "erro interno ao enviar", r);
    }
  }
}

export async function processarLembretes(opcoes: OpcoesProcessamento = {}): Promise<ResultadoProcessamento> {
  const agora = opcoes.agora ?? new Date();
  const r: ResultadoProcessamento = {
    lembretesProcessados: 0,
    lembretesIgnorados: 0,
    entregasEnviadas: 0,
    entregasReagendadas: 0,
    entregasFalhas: 0,
    entregasIgnoradas: 0,
  };
  await materializarLembretes(agora, opcoes.limiteLembretes ?? 100, r, opcoes.apenasEmpresas);
  await enviarEntregas(agora, opcoes.limiteEntregas ?? 40, opcoes.enviar ?? enviarEmail, r, opcoes.apenasEmpresas);
  return r;
}
