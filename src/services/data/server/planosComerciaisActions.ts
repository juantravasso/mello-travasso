"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { exigirAdminAction, exigirSessaoAction } from "@/lib/auth/dal";
import { CHAVE_PLANO, CONTEXTOS_OFERTA, planoComercialSchema } from "@/lib/planos/comercial";
import type { PlanoComercialAdmin, PlanoComercialPublico, ResultadoAction } from "@/types";
import { registrarLogAdmin } from "./adminLog.server";
import { registrarEventoSeguro } from "./eventosCore.server";
import { exigirSenhaDoAdmin } from "./reautenticacao.server";
import { ErroDeNegocio, executar } from "./resultado.server";

// Catálogo comercial de planos. A vitrine (página de planos e ofertas) só lê o que está publicado; quem cadastra e
// publica é o administrador, com senha de novo, motivo e registro de ação. Nada aqui concede acesso nem cobra.

const CAMPOS_PUBLICOS = { chave: true, nome: true, descricao: true, precoMensalCentavos: true, precoAnualCentavos: true, beneficios: true, destaque: true } as const;

export async function obterPlanosPublicos(): Promise<ResultadoAction<PlanoComercialPublico[]>> {
  await exigirSessaoAction();
  return executar(() => prisma.planoComercial.findMany({ where: { publicado: true }, select: CAMPOS_PUBLICOS, orderBy: [{ ordem: "asc" }, { nome: "asc" }] }));
}

export async function obterPlanosAdmin(): Promise<ResultadoAction<PlanoComercialAdmin[]>> {
  await exigirAdminAction();
  return executar(() =>
    prisma.planoComercial.findMany({ select: { ...CAMPOS_PUBLICOS, publicado: true, ordem: true, atualizadoEm: true }, orderBy: [{ ordem: "asc" }, { nome: "asc" }] }),
  );
}

/** Cria ou atualiza o plano pela chave. Despublicar é a forma de tirar do ar: nada é apagado. */
export async function salvarPlanoComercial(entrada: unknown, motivo: string, senha?: string): Promise<ResultadoAction<null>> {
  const admin = await exigirAdminAction();
  return executar(async () => {
    const parsed = planoComercialSchema.safeParse(entrada);
    if (!parsed.success) throw new ErroDeNegocio(parsed.error.issues[0]?.message ?? "Plano inválido.");
    const textoMotivo = typeof motivo === "string" ? motivo.trim() : "";
    if (textoMotivo.length < 5) throw new ErroDeNegocio("Descreva o motivo (mínimo 5 letras).");
    await exigirSenhaDoAdmin(admin.usuarioId, senha);

    const p = parsed.data;
    const agora = new Date().toISOString();
    await prisma.$transaction(async (tx) => {
      const anterior = await tx.planoComercial.findUnique({ where: { chave: p.chave }, select: CAMPOS_PUBLICOS });
      await tx.planoComercial.upsert({
        where: { chave: p.chave },
        create: { ...p, criadoEm: agora, atualizadoEm: agora },
        update: { ...p, atualizadoEm: agora },
      });
      await registrarLogAdmin(tx, admin.usuarioId, "plano_comercial.salvar", "PlanoComercial", p.chave, { motivo: textoMotivo, de: anterior, para: p });
    });
    return null;
  });
}

const interacaoSchema = z
  .object({
    contexto: z.enum(CONTEXTOS_OFERTA),
    tipo: z.enum(["visualizada", "clicada"]),
    planoChave: z.string().regex(CHAVE_PLANO).max(30).optional(),
  })
  .strict();

/**
 * Métrica de oferta: o cliente avisa que viu ou clicou, o servidor registra uma vez por pessoa, contexto e dia.
 * Falha de métrica nunca atrapalha a tela.
 */
export async function registrarInteracaoOferta(entrada: unknown): Promise<ResultadoAction<null>> {
  const sessao = await exigirSessaoAction();
  return executar(async () => {
    const parsed = interacaoSchema.safeParse(entrada);
    if (!parsed.success) throw new ErroDeNegocio("Dados inválidos.");
    const { contexto, tipo, planoChave } = parsed.data;
    const agora = new Date();
    await registrarEventoSeguro({
      tipo: tipo === "visualizada" ? "oferta_visualizada" : "oferta_clicada",
      empresaId: sessao.empresaId,
      usuarioId: sessao.usuarioId,
      chave: `oferta:${tipo}:${sessao.usuarioId}:${contexto}:${planoChave ?? "-"}:${agora.toISOString().slice(0, 10)}`,
      dados: { contexto, ...(planoChave ? { plano: planoChave } : {}) },
      agora,
    });
    return null;
  });
}
