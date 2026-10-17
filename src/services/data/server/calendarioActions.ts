"use server";

import { exigirGestaoAction, exigirGestaoEscritaAction, exigirSessaoAction } from "@/lib/auth/dal";
import { verificarLimite } from "@/lib/auth/limite";
import { idSchema, periodoSchema, preferenciasSchema } from "@/lib/validacao/calendario";
import type {
  ColegaItem,
  CompromissoItem,
  EntradaCompromisso,
  ListaCompromissos,
  PreferenciasCalendario,
  ResultadoAction,
} from "@/types";
import * as core from "./calendarioCore.server";
import { ErroDeNegocio, executar } from "./resultado.server";

// Server Actions do calendário. A identidade e a empresa vêm da SESSÃO (nunca de parâmetro); as regras estão em
// calendarioCore.server.ts. Leitura exige o módulo de gestão; escrita exige também que o teste não tenha vencido.

const ESCRITAS_POR_HORA = 200;
const UMA_HORA_MS = 60 * 60 * 1000;

async function limitarEscritas(usuarioId: string): Promise<void> {
  const limite = await verificarLimite(`calendario-escrita:${usuarioId}`, ESCRITAS_POR_HORA, UMA_HORA_MS);
  if (!limite.permitido) throw new ErroDeNegocio("Muitas alterações em pouco tempo. Tente de novo em alguns minutos.");
}

export async function listarCompromissos(de: string, ate: string): Promise<ResultadoAction<ListaCompromissos>> {
  return executar(async () => {
    const sessao = await exigirGestaoAction();
    const periodo = periodoSchema.safeParse({ de, ate });
    if (!periodo.success) throw new ErroDeNegocio(periodo.error.issues[0]?.message ?? "Período inválido.");
    return core.listarNoPeriodo(sessao, periodo.data.de, periodo.data.ate);
  });
}

export async function listarProximosCompromissos(limite: number = 8): Promise<ResultadoAction<CompromissoItem[]>> {
  return executar(async () => {
    const sessao = await exigirGestaoAction();
    return core.listarProximos(sessao, Number.isInteger(limite) ? limite : 8);
  });
}

export async function obterCompromisso(id: string): Promise<ResultadoAction<CompromissoItem>> {
  return executar(async () => {
    const sessao = await exigirGestaoAction();
    const parsed = idSchema.safeParse({ id });
    if (!parsed.success) throw new ErroDeNegocio("Compromisso não encontrado.");
    return core.obterUm(sessao, parsed.data.id);
  });
}

export async function listarColegas(): Promise<ResultadoAction<ColegaItem[]>> {
  return executar(async () => {
    const sessao = await exigirGestaoAction();
    return core.listarColegas(sessao);
  });
}

export async function criarCompromisso(entrada: EntradaCompromisso): Promise<ResultadoAction<CompromissoItem>> {
  return executar(async () => {
    const sessao = await exigirGestaoEscritaAction();
    await limitarEscritas(sessao.usuarioId);
    return core.criar(sessao, entrada);
  });
}

export async function atualizarCompromisso(id: string, entrada: EntradaCompromisso): Promise<ResultadoAction<CompromissoItem>> {
  return executar(async () => {
    const sessao = await exigirGestaoEscritaAction();
    await limitarEscritas(sessao.usuarioId);
    const parsed = idSchema.safeParse({ id });
    if (!parsed.success) throw new ErroDeNegocio("Compromisso não encontrado.");
    return core.atualizar(sessao, parsed.data.id, entrada);
  });
}

export async function excluirCompromisso(id: string): Promise<ResultadoAction<null>> {
  return executar(async () => {
    const sessao = await exigirGestaoEscritaAction();
    await limitarEscritas(sessao.usuarioId);
    const parsed = idSchema.safeParse({ id });
    if (!parsed.success) throw new ErroDeNegocio("Compromisso não encontrado.");
    await core.excluir(sessao, parsed.data.id);
    return null;
  });
}

// --- Preferências de lembrete (qualquer usuário) e fuso da empresa (só o dono) ---

export async function obterPreferenciasCalendario(): Promise<ResultadoAction<PreferenciasCalendario>> {
  return executar(async () => {
    const sessao = await exigirSessaoAction();
    return core.obterPreferencias(sessao, sessao.papel);
  });
}

export async function salvarPreferenciasCalendario(prefs: { lembretesPorEmail: boolean; lembretesNoApp: boolean }): Promise<ResultadoAction<null>> {
  return executar(async () => {
    const sessao = await exigirSessaoAction();
    const parsed = preferenciasSchema.safeParse(prefs);
    if (!parsed.success) throw new ErroDeNegocio("Preferências inválidas.");
    await core.salvarPreferencias(sessao, parsed.data);
    return null;
  });
}

export async function salvarFusoHorarioDaEmpresa(fuso: string): Promise<ResultadoAction<null>> {
  return executar(async () => {
    const sessao = await exigirSessaoAction();
    if (typeof fuso !== "string") throw new ErroDeNegocio("Fuso horário inválido.");
    await core.salvarFuso(sessao, sessao.papel, fuso);
    return null;
  });
}
