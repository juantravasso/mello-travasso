"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { exigirSessaoAction } from "@/lib/auth/dal";
import { CHAVE_PLANO } from "@/lib/planos/comercial";
import { criarPreapproval, criarPreferenciaAnual, ErroMercadoPago } from "@/lib/mercadopago/cliente.server";
import { urlDoSite } from "@/lib/rede/site";
import type { ResultadoAction } from "@/types";
import { gravarReferenciaExterna, liberarReserva, reservarVaga } from "./assinaturaComercialCore.server";
import { ErroDeNegocio, executar } from "./resultado.server";

// Início do checkout real (mensal recorrente via preapproval, anual parcelado via Checkout Pro). A confirmação
// (ativar o plano, liberar/ocupar vaga) só acontece pelo webhook — nunca aqui: ninguém fica "ativo" por um clique
// sem o Mercado Pago ter de fato confirmado o pagamento (ver assinaturaComercialCore.server.ts).

const chaveSchema = z.string().regex(CHAVE_PLANO).max(30);

function chaveOuFalha(chaveEntrada: unknown): string {
  const parsed = chaveSchema.safeParse(chaveEntrada);
  if (!parsed.success) throw new ErroDeNegocio("Plano inválido.");
  return parsed.data;
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
    if (sessao.papel !== "dono") throw new ErroDeNegocio("Só o dono da empresa pode contratar um plano.");

    const plano = await planoPublicadoOuFalha(chave);
    const reserva = await reservarVaga(sessao.empresaId, chave, "mensal", null);

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
    if (sessao.papel !== "dono") throw new ErroDeNegocio("Só o dono da empresa pode contratar um plano.");

    const plano = await planoPublicadoOuFalha(chave);
    const parcelas = plano.parcelasSemJuros ?? 1;
    const reserva = await reservarVaga(sessao.empresaId, chave, "anual", parcelas);

    try {
      const preferencia = await criarPreferenciaAnual({
        titulo: `Plano anual ${plano.nome} — Elo Negócios`,
        externalReference: reserva.id,
        valorCentavos: reserva.valorCentavos,
        parcelas,
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
