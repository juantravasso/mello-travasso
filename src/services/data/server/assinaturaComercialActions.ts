"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { exigirSessaoAction } from "@/lib/auth/dal";
import { CHAVE_PLANO } from "@/lib/planos/comercial";
import { consultarPagamento, criarPagamentoPix, criarPreapproval, criarPreferenciaAnual, ErroMercadoPago } from "@/lib/mercadopago/cliente.server";
import { urlDoSite } from "@/lib/rede/site";
import type { ResultadoAction } from "@/types";
import { confirmarPagamentoUnico, gravarReferenciaExterna, liberarReserva, reservarVaga } from "./assinaturaComercialCore.server";
import { ErroDeNegocio, executar } from "./resultado.server";

// Início do checkout real: mensal no cartão = assinatura recorrente (preapproval); anual no cartão = Checkout Pro, em
// até 12x com os juros do cartão; Pix (mensal ou anual) = pagamento único com QR dentro do site. A confirmação (ativar
// o plano, ocupar vaga) só acontece pelo Mercado Pago, via webhook ou conferindo o pagamento com ele — nunca por um
// clique: ninguém fica "ativo" sem o Mercado Pago ter de fato confirmado o pagamento (ver assinaturaComercialCore.server.ts).

const chaveSchema = z.string().regex(CHAVE_PLANO).max(30);
const cicloSchema = z.enum(["mensal", "anual"]);
const reservaIdSchema = z.string().uuid();

const MINUTOS_PIX = 30;

function chaveOuFalha(chaveEntrada: unknown): string {
  const parsed = chaveSchema.safeParse(chaveEntrada);
  if (!parsed.success) throw new ErroDeNegocio("Plano inválido.");
  return parsed.data;
}

function exigirDono(papel: string): void {
  if (papel !== "dono") throw new ErroDeNegocio("Só o dono da empresa pode contratar um plano.");
}

async function planoPublicadoOuFalha(chave: string) {
  const plano = await prisma.planoComercial.findUnique({ where: { chave } });
  if (!plano || !plano.publicado) throw new ErroDeNegocio("Plano não encontrado.");
  return plano;
}

export async function iniciarAssinaturaMensal(chaveEntrada: unknown): Promise<ResultadoAction<{ url: string }>> {
  const sessao = await exigirSessaoAction();
  return executar(async () => {
    const chave = chaveOuFalha(chaveEntrada);
    exigirDono(sessao.papel);

    const plano = await planoPublicadoOuFalha(chave);
    const reserva = await reservarVaga(sessao.empresaId, chave, "mensal", "cartao");

    try {
      const preapproval = await criarPreapproval({
        motivo: `Assinatura ${plano.nome} — Elo Negócios`,
        externalReference: reserva.id,
        valorCentavos: reserva.valorCentavos,
        payerEmail: sessao.email,
        backUrl: `${urlDoSite()}/planos`,
        chaveIdempotencia: reserva.id,
      });
      await gravarReferenciaExterna(reserva.id, preapproval.id);
      return { url: preapproval.init_point };
    } catch (erro) {
      await liberarReserva(reserva.id);
      if (erro instanceof ErroMercadoPago) throw new ErroDeNegocio("Não foi possível iniciar a assinatura agora. Tente de novo em instantes.");
      throw erro;
    }
  });
}

export async function iniciarPagamentoAnual(chaveEntrada: unknown): Promise<ResultadoAction<{ url: string }>> {
  const sessao = await exigirSessaoAction();
  return executar(async () => {
    const chave = chaveOuFalha(chaveEntrada);
    exigirDono(sessao.papel);

    const plano = await planoPublicadoOuFalha(chave);
    const reserva = await reservarVaga(sessao.empresaId, chave, "anual", "cartao");

    try {
      const preferencia = await criarPreferenciaAnual({
        titulo: `Plano anual ${plano.nome} — Elo Negócios`,
        externalReference: reserva.id,
        valorCentavos: reserva.valorCentavos,
        payerEmail: sessao.email,
        backUrls: { success: `${urlDoSite()}/planos`, failure: `${urlDoSite()}/planos`, pending: `${urlDoSite()}/planos` },
        chaveIdempotencia: reserva.id,
      });
      await gravarReferenciaExterna(reserva.id, preferencia.id);
      return { url: preferencia.init_point };
    } catch (erro) {
      await liberarReserva(reserva.id);
      if (erro instanceof ErroMercadoPago) throw new ErroDeNegocio("Não foi possível iniciar o pagamento agora. Tente de novo em instantes.");
      throw erro;
    }
  });
}

export interface PixIniciado {
  reservaId: string;
  valorCentavos: number;
  /** Código "copia e cola" do Pix. */
  copiaECola: string;
  /** Imagem do QR em base64 (PNG). */
  qrCodeBase64: string;
  expiraEm: string;
}

/** Pagamento por Pix do plano, mensal (1 mês de acesso) ou anual (12 meses): devolve o QR e o copia e cola para mostrar no site. */
export async function iniciarPagamentoPix(chaveEntrada: unknown, cicloEntrada: unknown): Promise<ResultadoAction<PixIniciado>> {
  const sessao = await exigirSessaoAction();
  return executar(async () => {
    const chave = chaveOuFalha(chaveEntrada);
    const ciclo = cicloSchema.safeParse(cicloEntrada);
    if (!ciclo.success) throw new ErroDeNegocio("Período inválido.");
    exigirDono(sessao.papel);

    const plano = await planoPublicadoOuFalha(chave);
    const reserva = await reservarVaga(sessao.empresaId, chave, ciclo.data, "pix");
    const expiraEm = new Date(Date.now() + MINUTOS_PIX * 60_000);

    try {
      const pagamento = await criarPagamentoPix({
        descricao: `Plano ${ciclo.data === "anual" ? "anual" : "mensal"} ${plano.nome} — Elo Negócios`,
        externalReference: reserva.id,
        valorCentavos: reserva.valorCentavos,
        payerEmail: sessao.email,
        expiraEm,
        chaveIdempotencia: reserva.id,
      });
      const dados = pagamento.point_of_interaction?.transaction_data;
      if (!dados?.qr_code || !dados.qr_code_base64) throw new ErroMercadoPago(502, "Resposta do Pix sem QR.");
      await gravarReferenciaExterna(reserva.id, String(pagamento.id));
      return { reservaId: reserva.id, valorCentavos: reserva.valorCentavos, copiaECola: dados.qr_code, qrCodeBase64: dados.qr_code_base64, expiraEm: expiraEm.toISOString() };
    } catch (erro) {
      await liberarReserva(reserva.id);
      if (erro instanceof ErroMercadoPago) throw new ErroDeNegocio("Não foi possível gerar o Pix agora. Tente de novo em instantes.");
      throw erro;
    }
  });
}

export type EstadoPix = "aguardando" | "pago" | "expirado" | "sem_vaga";

/**
 * Confere se o Pix foi pago. O webhook costuma confirmar primeiro; aqui, enquanto a reserva está aberta, consulta o
 * Mercado Pago direto (a tela não precisa esperar). Só vale para a reserva da própria empresa.
 */
export async function verificarPagamentoPix(reservaIdEntrada: unknown): Promise<ResultadoAction<{ estado: EstadoPix }>> {
  const sessao = await exigirSessaoAction();
  return executar(async () => {
    const id = reservaIdSchema.safeParse(reservaIdEntrada);
    if (!id.success) throw new ErroDeNegocio("Pagamento inválido.");
    exigirDono(sessao.papel);

    const ler = () => prisma.assinaturaComercial.findFirst({ where: { id: id.data, empresaId: sessao.empresaId, meio: "pix" } });
    let reserva = await ler();
    if (!reserva) throw new ErroDeNegocio("Pagamento não encontrado.");

    if (reserva.status === "reservada" && reserva.referenciaExterna) {
      try {
        const pagamento = await consultarPagamento(reserva.referenciaExterna);
        if (pagamento.external_reference === reserva.id) {
          await confirmarPagamentoUnico(reserva.id, String(pagamento.id), pagamento.status);
          reserva = (await ler()) ?? reserva;
        }
      } catch (erro) {
        if (!(erro instanceof ErroMercadoPago)) throw erro;
        // Mercado Pago indisponível agora: segue "aguardando"; o webhook ou a próxima conferência resolve.
      }
    }

    if (reserva.status === "ativa") return { estado: "pago" as const };
    if (reserva.status === "paga_sem_vaga") return { estado: "sem_vaga" as const };
    if (reserva.status === "reservada") return { estado: "aguardando" as const };
    return { estado: "expirado" as const };
  });
}
