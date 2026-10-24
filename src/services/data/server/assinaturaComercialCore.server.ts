import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { enviarEmail } from "@/lib/email/enviar.server";
import { fimDoPeriodoPago, somarMeses } from "@/lib/planos/periodo";
import { urlDoSite } from "@/lib/rede/site";
import { registrarEvento } from "./eventosCore.server";
import { contarOcupacao } from "./planosComerciaisCore.server";
import { ErroDeNegocio } from "./resultado.server";

// Cobrança real dos planos comerciais via Mercado Pago. Mensal é assinatura recorrente (preapproval): o Mercado
// Pago manda o estado certo. Anual é pagamento único parcelado: não existe recorrência de verdade no provedor, a
// "renovação" é só um aviso por e-mail antes do vencimento, seguido de um novo pagamento.
//
// Vaga (vagasTotal do plano): reservada no início do checkout, não só confirmada no webhook — evita que alguém
// pague por uma vaga que já foi para outro cliente enquanto está no meio do pagamento. Reserva expira em
// TTL_RESERVA_MIN se o pagamento não se completar; a confirmação sempre reconfere vaga ao vivo antes de liberar
// acesso (o pagamento pode ter chegado depois da reserva expirar, ou a vaga pode ter ido para outro).

const TTL_RESERVA_MIN = 45;
const DIAS_AVISO_RENOVACAO = 14;

type Tx = Prisma.TransactionClient;

/** Passa a empresa para somente leitura, mas só se ela está no plano Ativo por este plano comercial (nunca derruba cortesia ou outro plano). */
async function suspender(tx: Tx, empresaId: string, planoChave: string, agoraIso: string): Promise<void> {
  await tx.empresa.updateMany({ where: { id: empresaId, plano: "ativo", planoComercialChave: planoChave }, data: { plano: "suspenso", atualizadoEm: agoraIso } });
}

export interface ReservaCriada {
  id: string;
  valorCentavos: number;
}

/** Reserva a vaga (se o plano tiver limite) e cria a cobrança em status "reservada". Lança ErroDeNegocio se não houver vaga ou a empresa já tiver uma contratação em andamento/ativa neste plano e ciclo. */
export async function reservarVaga(empresaId: string, chave: string, ciclo: "mensal" | "anual", parcelas: number | null): Promise<ReservaCriada> {
  const agora = new Date();
  const agoraIso = agora.toISOString();
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "PlanoComercial" WHERE "chave" = ${chave} FOR UPDATE`;
    const plano = await tx.planoComercial.findUnique({ where: { chave } });
    if (!plano || !plano.publicado) throw new ErroDeNegocio("Plano não encontrado.");
    const preco = ciclo === "mensal" ? plano.precoMensalCentavos : plano.precoAnualCentavos;
    if (preco === null) throw new ErroDeNegocio("Este plano está sob consulta: fale com a equipe.");

    const jaTem = await tx.assinaturaComercial.findFirst({ where: { empresaId, planoChave: chave, ciclo, status: { in: ["reservada", "ativa"] } } });
    if (jaTem) throw new ErroDeNegocio("Você já tem uma contratação em andamento ou ativa para este plano.");
    const empresa = await tx.empresa.findUnique({ where: { id: empresaId }, select: { plano: true, planoComercialChave: true } });
    if (empresa?.plano === "ativo" && empresa.planoComercialChave === chave) {
      // Quem cancelou e ainda está no período pago pode assinar de novo (a assinatura nova assume quando o período acabar).
      const emCarencia = await tx.assinaturaComercial.findFirst({ where: { empresaId, planoChave: chave, ciclo: "mensal", status: "cancelada", proximaCobrancaEm: { gt: agoraIso } } });
      if (!emCarencia) throw new ErroDeNegocio("Sua empresa já está neste plano.");
    }

    if (plano.vagasTotal !== null) {
      const ocupadas = await contarOcupacao(tx, chave, agoraIso, { empresaId });
      if (ocupadas >= plano.vagasTotal) throw new ErroDeNegocio("Este plano não tem mais vagas.");
    }

    const reserva = await tx.assinaturaComercial.create({
      data: {
        empresaId,
        planoChave: chave,
        ciclo,
        status: "reservada",
        parcelas,
        valorCentavos: preco,
        reservaExpiraEm: new Date(agora.getTime() + TTL_RESERVA_MIN * 60_000).toISOString(),
        criadoEm: agoraIso,
        atualizadoEm: agoraIso,
      },
    });
    return { id: reserva.id, valorCentavos: reserva.valorCentavos };
  });
}

/** Grava a referência do Mercado Pago assim que a assinatura/preferência é criada (antes da confirmação). */
export async function gravarReferenciaExterna(reservaId: string, referenciaExterna: string): Promise<void> {
  await prisma.assinaturaComercial.update({ where: { id: reservaId }, data: { referenciaExterna, atualizadoEm: new Date().toISOString() } });
}

/** A chamada ao Mercado Pago falhou depois da reserva: libera a vaga na hora, sem esperar o TTL. */
export async function liberarReserva(reservaId: string): Promise<void> {
  await prisma.assinaturaComercial.updateMany({ where: { id: reservaId, status: "reservada" }, data: { status: "expirada", atualizadoEm: new Date().toISOString() } });
}

/**
 * Confirmação de evento de assinatura mensal (preapproval). `reservaId` é o `external_reference` que a gente
 * mandou na criação — nunca o id do Mercado Pago, que só existe depois de criado. Notificação para uma reserva
 * que não existe ou não é do ciclo mensal é ignorada (não é nossa).
 */
export async function confirmarAssinaturaMensal(reservaId: string, preapprovalId: string, statusMp: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const reserva = await tx.assinaturaComercial.findUnique({ where: { id: reservaId } });
    if (!reserva || reserva.ciclo !== "mensal") return;
    const agoraIso = new Date().toISOString();

    if (statusMp === "authorized") {
      if (reserva.status === "ativa") return;
      const plano = await tx.planoComercial.findUnique({ where: { chave: reserva.planoChave } });
      if (plano?.vagasTotal !== null && plano) {
        const ocupadas = await contarOcupacao(tx, reserva.planoChave, agoraIso, { reservaId: reserva.id, empresaId: reserva.empresaId });
        if (ocupadas >= plano.vagasTotal) {
          await tx.assinaturaComercial.update({ where: { id: reserva.id }, data: { status: "paga_sem_vaga", referenciaExterna: preapprovalId, atualizadoEm: agoraIso } });
          return;
        }
      }
      // A primeira cobrança acontece na autorização, então o primeiro mês pago termina daqui a um mês.
      const proximaCobrancaEm = reserva.proximaCobrancaEm ?? somarMeses(new Date(agoraIso), 1).toISOString();
      await tx.assinaturaComercial.update({ where: { id: reserva.id }, data: { status: "ativa", referenciaExterna: preapprovalId, proximaCobrancaEm, atualizadoEm: agoraIso } });
      await tx.empresa.update({ where: { id: reserva.empresaId }, data: { plano: "ativo", planoComercialChave: reserva.planoChave, atualizadoEm: agoraIso } });
    } else if (statusMp === "cancelled") {
      const estavaAtiva = reserva.status === "ativa";
      // Cancelar encerra as próximas cobranças, mas o período já pago continua valendo: a empresa segue ativa e o cron
      // suspende quando `proximaCobrancaEm` passar. Notificação repetida não mexe na data (só a primeira, de quem estava ativa).
      const data: Prisma.AssinaturaComercialUpdateInput = { status: "cancelada", referenciaExterna: preapprovalId, atualizadoEm: agoraIso };
      if (estavaAtiva) data.proximaCobrancaEm = fimDoPeriodoPago(reserva.proximaCobrancaEm ?? agoraIso, new Date(agoraIso)).toISOString();
      await tx.assinaturaComercial.update({ where: { id: reserva.id }, data });
    } else if (statusMp === "paused") {
      const estavaAtiva = reserva.status === "ativa";
      await tx.assinaturaComercial.update({ where: { id: reserva.id }, data: { status: "pausada", referenciaExterna: preapprovalId, atualizadoEm: agoraIso } });
      // Pausa (cobrança falhou ou foi pausada) suspende já: plano "suspenso" = somente leitura, dados preservados.
      // Só quem estava ativo por esta assinatura; um checkout abandonado não mexe numa empresa que ocupa o plano por outro caminho.
      if (estavaAtiva) await suspender(tx, reserva.empresaId, reserva.planoChave, agoraIso);
    }
  });
}

/** Confirmação de pagamento do anual (payment). Mesma lógica de `reservaId` = external_reference do confirmarAssinaturaMensal. */
export async function confirmarPagamentoAnual(reservaId: string, paymentId: string, statusMp: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const reserva = await tx.assinaturaComercial.findUnique({ where: { id: reservaId } });
    if (!reserva || reserva.ciclo !== "anual") return;
    const agoraIso = new Date().toISOString();

    if (statusMp === "approved") {
      if (reserva.status === "ativa") return;
      const plano = await tx.planoComercial.findUnique({ where: { chave: reserva.planoChave } });
      if (plano?.vagasTotal !== null && plano) {
        const ocupadas = await contarOcupacao(tx, reserva.planoChave, agoraIso, { reservaId: reserva.id, empresaId: reserva.empresaId });
        if (ocupadas >= plano.vagasTotal) {
          await tx.assinaturaComercial.update({ where: { id: reserva.id }, data: { status: "paga_sem_vaga", referenciaExterna: paymentId, atualizadoEm: agoraIso } });
          return;
        }
      }
      const proximaCobrancaEm = new Date(Date.now() + 365 * 86_400_000).toISOString();
      await tx.assinaturaComercial.update({ where: { id: reserva.id }, data: { status: "ativa", referenciaExterna: paymentId, proximaCobrancaEm, atualizadoEm: agoraIso } });
      await tx.empresa.update({ where: { id: reserva.empresaId }, data: { plano: "ativo", planoComercialChave: reserva.planoChave, atualizadoEm: agoraIso } });
    } else if (statusMp === "rejected" || statusMp === "cancelled") {
      if (reserva.status === "ativa") return; // pagamento já confirmado antes; notificação atrasada não desfaz
      await tx.assinaturaComercial.update({ where: { id: reserva.id }, data: { status: "expirada", referenciaExterna: paymentId, atualizadoEm: agoraIso } });
    }
  });
}

/**
 * Trilha de auditoria do webhook: uma linha por tipo, id e estado recebido. Grava DEPOIS de processar com sucesso e não
 * impede nada: o mesmo pagamento ou assinatura muda de estado várias vezes (pendente → aprovado, autorizada →
 * cancelada) e cada notificação precisa ser tratada. A idempotência real está nas confirmações, que olham o estado.
 */
export async function registrarWebhookProcessado(tipo: string, dataId: string, estado: string): Promise<void> {
  await registrarEvento(prisma, { tipo: "mp_webhook_recebido", chave: `mp:${tipo}:${dataId}:${estado}`, dados: { tipo, dataId, estado } });
}

async function donosAtivos(empresaId: string) {
  return prisma.usuario.findMany({ where: { empresaId, papel: "dono", desativadoEm: null, bloqueadoPlataformaEm: null } });
}

export interface ResultadoAssinaturasComerciais {
  reservasExpiradas: number;
  avisosRenovacao: number;
  suspensasPorVencimento: number;
  fimDoAcesso: number;
}

/**
 * Chamado pelo cron (ver /api/cron/assinaturas): expira reservas vencidas, avisa por e-mail quem está perto da
 * renovação anual e suspende quem passou do vencimento sem renovar. Idempotente (chave por assinatura+data).
 */
export async function processarAssinaturasComerciais(agora: Date = new Date()): Promise<ResultadoAssinaturasComerciais> {
  const agoraIso = agora.toISOString();
  const resultado: ResultadoAssinaturasComerciais = { reservasExpiradas: 0, avisosRenovacao: 0, suspensasPorVencimento: 0, fimDoAcesso: 0 };

  const expiradas = await prisma.assinaturaComercial.updateMany({
    where: { status: "reservada", reservaExpiraEm: { lt: agoraIso } },
    data: { status: "expirada", atualizadoEm: agoraIso },
  });
  resultado.reservasExpiradas = expiradas.count;

  const limiteAviso = new Date(agora.getTime() + DIAS_AVISO_RENOVACAO * 86_400_000).toISOString();
  const aRenovar = await prisma.assinaturaComercial.findMany({
    where: { ciclo: "anual", status: "ativa", proximaCobrancaEm: { lte: limiteAviso, gt: agoraIso } },
    include: { planoComercial: true },
  });
  for (const a of aRenovar) {
    if (!a.proximaCobrancaEm) continue;
    const chave = `assinatura:renovacao:${a.id}:${a.proximaCobrancaEm}`;
    const novo = await registrarEvento(prisma, { tipo: "assinatura_renovacao_avisada", empresaId: a.empresaId, chave, dados: { plano: a.planoChave } });
    if (!novo) continue;
    const vencimento = a.proximaCobrancaEm.slice(0, 10);
    for (const dono of await donosAtivos(a.empresaId)) {
      await enviarEmail({
        para: dono.email,
        assunto: `Sua assinatura anual (${a.planoComercial.nome}) vence em ${vencimento}`,
        texto: `Olá! Sua assinatura anual do plano ${a.planoComercial.nome} vence em ${vencimento}. Acesse ${urlDoSite()}/planos para renovar.`,
        html: `<p>Olá! Sua assinatura anual do plano <strong>${a.planoComercial.nome}</strong> vence em ${vencimento}.</p><p><a href="${urlDoSite()}/planos">Renovar agora</a></p>`,
        chaveIdempotencia: chave,
      });
    }
    resultado.avisosRenovacao++;
  }

  const vencidas = await prisma.assinaturaComercial.findMany({ where: { ciclo: "anual", status: "ativa", proximaCobrancaEm: { lt: agoraIso } } });
  for (const a of vencidas) {
    const processou = await prisma.$transaction(async (tx) => {
      const chave = `assinatura:suspensao:${a.id}:${a.proximaCobrancaEm}`;
      const novo = await registrarEvento(tx, { tipo: "assinatura_suspensa_vencimento", empresaId: a.empresaId, chave });
      if (!novo) return false;
      await tx.assinaturaComercial.update({ where: { id: a.id }, data: { status: "cancelada", atualizadoEm: agoraIso } });
      await suspender(tx, a.empresaId, a.planoChave, agoraIso);
      return true;
    });
    if (processou) resultado.suspensasPorVencimento++;
  }

  // Mensal cancelada: o acesso valeu até o fim do período pago; passou da data, suspende (somente leitura).
  const fimDoAcesso = await prisma.assinaturaComercial.findMany({ where: { ciclo: "mensal", status: "cancelada", proximaCobrancaEm: { lt: agoraIso } } });
  for (const a of fimDoAcesso) {
    const processou = await prisma.$transaction(async (tx) => {
      const chave = `assinatura:fim-do-acesso:${a.id}:${a.proximaCobrancaEm}`;
      const novo = await registrarEvento(tx, { tipo: "assinatura_fim_do_acesso", empresaId: a.empresaId, chave });
      if (!novo) return false;
      // Se a empresa assinou de novo o mesmo plano, a assinatura nova é quem a mantém ativa: não suspender.
      const outraAtiva = await tx.assinaturaComercial.findFirst({ where: { empresaId: a.empresaId, planoChave: a.planoChave, status: "ativa", id: { not: a.id } } });
      if (!outraAtiva) await suspender(tx, a.empresaId, a.planoChave, agoraIso);
      return !outraAtiva;
    });
    if (processou) resultado.fimDoAcesso++;
  }

  return resultado;
}
