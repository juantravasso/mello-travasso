"use server";

import { z } from "zod";
import { exigirSessaoAction } from "@/lib/auth/dal";
import { configWhatsapp } from "@/lib/whatsapp/waha.server";
import { linkDeVinculo, textoDeVinculo } from "@/lib/whatsapp/vinculo";
import type { ResultadoAction } from "@/types";
import { definirAvisos, desfazerVinculo, estadoDoVinculo, gerarCodigoDeVinculo, type EstadoVinculo } from "./whatsappCore.server";
import { ErroDeNegocio, executar } from "./resultado.server";

// Cada usuário cuida só do próprio vínculo: nenhuma ação recebe usuarioId do navegador (vem da sessão).

export interface VinculoParaTela extends EstadoVinculo {
  /** Falso quando o WhatsApp não está configurado no servidor: a tela esconde o recurso. */
  disponivel: boolean;
}

export async function obterVinculoWhatsapp(): Promise<ResultadoAction<VinculoParaTela>> {
  const sessao = await exigirSessaoAction();
  return executar(async () => ({ disponivel: configWhatsapp() !== null, ...(await estadoDoVinculo(sessao.usuarioId)) }));
}

export interface VinculoIniciado {
  texto: string;
  link: string;
  expiraEm: string;
}

export async function iniciarVinculoWhatsapp(): Promise<ResultadoAction<VinculoIniciado>> {
  const sessao = await exigirSessaoAction();
  return executar(async () => {
    const cfg = configWhatsapp();
    if (!cfg) throw new ErroDeNegocio("O WhatsApp ainda não está disponível.");
    try {
      const { codigo, expiraEm } = await gerarCodigoDeVinculo(sessao.usuarioId);
      return { texto: textoDeVinculo(codigo), link: linkDeVinculo(cfg.numeroElo, codigo), expiraEm };
    } catch (erro) {
      if (erro instanceof Error && erro.message === "JA_VINCULADO") throw new ErroDeNegocio("Seu WhatsApp já está vinculado. Desvincule para usar outro número.");
      throw erro;
    }
  });
}

export async function alternarAvisosWhatsapp(ativosEntrada: unknown): Promise<ResultadoAction<null>> {
  const sessao = await exigirSessaoAction();
  return executar(async () => {
    const ativos = z.boolean().safeParse(ativosEntrada);
    if (!ativos.success) throw new ErroDeNegocio("Valor inválido.");
    await definirAvisos(sessao.usuarioId, ativos.data);
    return null;
  });
}

export async function desvincularWhatsapp(): Promise<ResultadoAction<null>> {
  const sessao = await exigirSessaoAction();
  return executar(async () => {
    await desfazerVinculo(sessao.usuarioId);
    return null;
  });
}
