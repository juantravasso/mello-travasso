import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { configWhatsapp, enviarTexto } from "@/lib/whatsapp/cliente.server";
import { dentroDoHorario, INTERVALO_MS, MAX_TENTATIVAS, POR_RODADA, proximaTentativa, tetoDiario, type TipoAvisoWhatsapp } from "@/lib/whatsapp/avisos";

// Fila de avisos da conta pelo WhatsApp (ver src/lib/whatsapp/avisos.ts). Quem gera o aviso (fim do teste, renovação,
// suspensão) chama agendarAvisoWhatsapp; o agendador do ciclo de vida chama enviarAvisosWhatsapp a cada 15 min.
// Destinatários: donos ativos da empresa com WhatsApp vinculado e avisos ligados — conferido ao agendar E ao enviar.

type Banco = typeof prisma | Prisma.TransactionClient;

export interface NovoAviso {
  empresaId: string;
  tipo: TipoAvisoWhatsapp;
  /** Chave do aviso (sem o usuário); cada destinatário vira `${chave}:${usuarioId}`. */
  chave: string;
  texto: string;
  expiraEm: Date;
  agora?: Date;
}

/** Agenda o aviso para os donos vinculados. Sem WhatsApp configurado, não agenda nada (evita acumular para depois). */
export async function agendarAvisoWhatsapp(db: Banco, aviso: NovoAviso): Promise<number> {
  if (!configWhatsapp()) return 0;
  const agora = aviso.agora ?? new Date();
  if (aviso.expiraEm <= agora) return 0;
  const destinos = await db.vinculoWhatsapp.findMany({
    where: {
      verificadoEm: { not: null },
      avisosAtivos: true,
      usuario: { empresaId: aviso.empresaId, papel: "dono", desativadoEm: null, bloqueadoPlataformaEm: null },
    },
    select: { usuarioId: true },
  });
  if (destinos.length === 0) return 0;
  const iso = agora.toISOString();
  const r = await db.avisoWhatsapp.createMany({
    data: destinos.map((d) => ({
      empresaId: aviso.empresaId,
      usuarioId: d.usuarioId,
      tipo: aviso.tipo,
      chave: `${aviso.chave}:${d.usuarioId}`,
      texto: aviso.texto,
      proximaTentativaEm: iso,
      expiraEm: aviso.expiraEm.toISOString(),
      criadoEm: iso,
      atualizadoEm: iso,
    })),
    skipDuplicates: true,
  });
  return r.count;
}

export interface ResultadoAvisosWhatsapp {
  enviados: number;
  cancelados: number;
  falhas: number;
  foraDoHorario: number;
  tetoAtingido: boolean;
}

export interface OpcoesEnvioAvisos {
  agora?: Date;
  enviar?: (chatId: string, texto: string) => Promise<void>;
  porRodada?: number;
  intervaloMs?: number;
  teto?: number;
  /** Só para testes: restringe a rodada a estas empresas. */
  apenasEmpresas?: string[];
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function marcar(id: string, data: Prisma.AvisoWhatsappUpdateInput): Promise<void> {
  await prisma.avisoWhatsapp.update({ where: { id }, data: { ...data, reservadoAte: null, atualizadoEm: new Date().toISOString() } });
}

export async function enviarAvisosWhatsapp(opcoes: OpcoesEnvioAvisos = {}): Promise<ResultadoAvisosWhatsapp> {
  const r: ResultadoAvisosWhatsapp = { enviados: 0, cancelados: 0, falhas: 0, foraDoHorario: 0, tetoAtingido: false };
  const enviar = opcoes.enviar ?? enviarTexto;
  if (!opcoes.enviar && !configWhatsapp()) return r;

  const agora = opcoes.agora ?? new Date();
  const iso = agora.toISOString();

  // Perderam o sentido: cancela de uma vez, sem enviar.
  const escopo = opcoes.apenasEmpresas ? { empresaId: { in: opcoes.apenasEmpresas } } : {};
  const vencidos = await prisma.avisoWhatsapp.updateMany({ where: { ...escopo, status: "pendente", expiraEm: { lte: iso } }, data: { status: "cancelado", ultimoErro: "expirou antes do envio", atualizadoEm: iso } });
  r.cancelados += vencidos.count;

  const teto = opcoes.teto ?? tetoDiario(process.env.WHATSAPP_AVISOS_DIA);
  const enviados24h = await prisma.avisoWhatsapp.count({ where: { status: "enviado", enviadoEm: { gte: new Date(agora.getTime() - 86_400_000).toISOString() } } });
  let restantes = Math.min(opcoes.porRodada ?? POR_RODADA, Math.max(0, teto - enviados24h));
  if (restantes === 0) {
    r.tetoAtingido = true;
    return r;
  }

  const candidatos = await prisma.avisoWhatsapp.findMany({
    where: { ...escopo, status: "pendente", proximaTentativaEm: { lte: iso }, OR: [{ reservadoAte: null }, { reservadoAte: { lt: iso } }] },
    orderBy: { criadoEm: "asc" },
    take: 100,
    include: {
      empresa: { select: { fusoHorario: true, bloqueadaEm: true } },
      usuario: { select: { desativadoEm: true, bloqueadoPlataformaEm: true, vinculoWhatsapp: { select: { chatId: true, verificadoEm: true, avisosAtivos: true } } } },
    },
  });

  let primeiro = true;
  for (const a of candidatos) {
    if (restantes === 0) {
      r.tetoAtingido = true;
      break;
    }
    const v = a.usuario.vinculoWhatsapp;
    if (!v?.verificadoEm || !v.chatId || !v.avisosAtivos || a.usuario.desativadoEm || a.usuario.bloqueadoPlataformaEm || a.empresa.bloqueadaEm) {
      await marcar(a.id, { status: "cancelado", ultimoErro: "destinatário sem vínculo ou com avisos desligados" });
      r.cancelados++;
      continue;
    }
    if (!dentroDoHorario(agora, a.empresa.fusoHorario)) {
      r.foraDoHorario++;
      continue;
    }

    // Reserva antes de enviar: duas rodadas ao mesmo tempo não mandam o mesmo aviso.
    const reservado = await prisma.avisoWhatsapp.updateMany({
      where: { id: a.id, status: "pendente", OR: [{ reservadoAte: null }, { reservadoAte: { lt: iso } }] },
      data: { reservadoAte: new Date(agora.getTime() + 5 * 60_000).toISOString() },
    });
    if (reservado.count === 0) continue;

    if (!primeiro) await esperar(opcoes.intervaloMs ?? INTERVALO_MS);
    primeiro = false;
    try {
      await enviar(v.chatId, a.texto);
      await marcar(a.id, { status: "enviado", enviadoEm: new Date().toISOString(), tentativas: { increment: 1 }, ultimoErro: null });
      r.enviados++;
      restantes--;
    } catch (erro) {
      const tentativas = a.tentativas + 1;
      const motivo = erro instanceof Error ? erro.message.slice(0, 200) : "erro";
      await marcar(a.id, tentativas >= MAX_TENTATIVAS ? { status: "falhou", tentativas, ultimoErro: motivo } : { tentativas, ultimoErro: motivo, proximaTentativaEm: proximaTentativa(agora, tentativas).toISOString() });
      r.falhas++;
    }
  }
  return r;
}
