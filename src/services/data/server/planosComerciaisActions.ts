"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { exigirAdminAction, exigirSessaoAction } from "@/lib/auth/dal";
import { CHAVE_PLANO, CONTEXTOS_OFERTA, planoComercialSchema, vagasRestantes } from "@/lib/planos/comercial";
import type { PlanoComercialAdmin, PlanoComercialPublico, ResultadoAction } from "@/types";
import { registrarLogAdmin } from "./adminLog.server";
import { registrarEventoSeguro } from "./eventosCore.server";
import { atribuirPlanoComercial } from "./planosComerciaisCore.server";
import { exigirSenhaDoAdmin } from "./reautenticacao.server";
import { ErroDeNegocio, executar } from "./resultado.server";

// Catálogo comercial de planos. A vitrine (página de planos e ofertas) só lê o que está publicado; quem cadastra e
// publica é o administrador, com senha de novo, motivo e registro de ação. Nada aqui concede acesso nem cobra.
//
// Vagas: o "restam N" que o cliente vê é sempre vagasTotal menos as empresas que de fato estão no plano ativo com
// aquela chave. Não existe campo para digitar "restam": a escassez mostrada só pode ser a real.

const CAMPOS = {
  chave: true,
  nome: true,
  descricao: true,
  precoMensalCentavos: true,
  precoAnualCentavos: true,
  beneficios: true,
  destaque: true,
  vagasTotal: true,
  parcelasSemJuros: true,
  condicao: true,
} as const;

/** Empresas que ocupam cada plano: no plano ativo (pagantes) e com a chave do plano comercial. */
async function ocupacao(chaves: string[]): Promise<Map<string, number>> {
  if (chaves.length === 0) return new Map();
  const linhas = await prisma.empresa.groupBy({
    by: ["planoComercialChave"],
    where: { planoComercialChave: { in: chaves }, plano: "ativo" },
    _count: { _all: true },
  });
  return new Map(linhas.flatMap((l) => (l.planoComercialChave ? [[l.planoComercialChave, l._count._all] as const] : [])));
}

export async function obterPlanosPublicos(): Promise<ResultadoAction<PlanoComercialPublico[]>> {
  await exigirSessaoAction();
  return executar(async () => {
    const planos = await prisma.planoComercial.findMany({ where: { publicado: true }, select: CAMPOS, orderBy: [{ ordem: "asc" }, { nome: "asc" }] });
    const ocupadas = await ocupacao(planos.map((p) => p.chave));
    return planos.map((p) => ({ ...p, vagasRestantes: vagasRestantes(p.vagasTotal, ocupadas.get(p.chave) ?? 0) }));
  });
}

export async function obterPlanosAdmin(): Promise<ResultadoAction<PlanoComercialAdmin[]>> {
  await exigirAdminAction();
  return executar(async () => {
    const planos = await prisma.planoComercial.findMany({ select: { ...CAMPOS, publicado: true, ordem: true, atualizadoEm: true }, orderBy: [{ ordem: "asc" }, { nome: "asc" }] });
    const ocupadas = await ocupacao(planos.map((p) => p.chave));
    return planos.map((p) => ({ ...p, vagasOcupadas: ocupadas.get(p.chave) ?? 0, vagasRestantes: vagasRestantes(p.vagasTotal, ocupadas.get(p.chave) ?? 0) }));
  });
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
      const anterior = await tx.planoComercial.findUnique({ where: { chave: p.chave }, select: CAMPOS });
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

const atribuicaoSchema = z.object({ empresaId: z.string().uuid(), chave: z.string().regex(CHAVE_PLANO).max(30).nullable() }).strict();

/** Registra qual plano comercial a empresa contratou (regras e controle de vagas em planosComerciaisCore). */
export async function definirPlanoComercialDaEmpresa(empresaId: string, chave: string | null, motivo: string, senha?: string): Promise<ResultadoAction<null>> {
  const admin = await exigirAdminAction();
  return executar(async () => {
    const parsed = atribuicaoSchema.safeParse({ empresaId, chave });
    if (!parsed.success) throw new ErroDeNegocio("Dados inválidos.");
    const textoMotivo = typeof motivo === "string" ? motivo.trim() : "";
    if (textoMotivo.length < 5) throw new ErroDeNegocio("Descreva o motivo (mínimo 5 letras).");
    await exigirSenhaDoAdmin(admin.usuarioId, senha);

    await atribuirPlanoComercial(admin.usuarioId, parsed.data.empresaId, parsed.data.chave, textoMotivo);
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
