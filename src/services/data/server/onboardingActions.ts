"use server";

import { z } from "zod";
import { exigirSessaoAction, obterRecursosDaEmpresa } from "@/lib/auth/dal";
import type { ChecklistOnboarding, ResultadoAction, TourComAjudas } from "@/types";
import { executar, ErroDeNegocio } from "./resultado.server";
import * as core from "./onboardingCore.server";

// Onboarding da própria pessoa. Usa a sessão normal (e não a de escrita): o progresso do tour é dela, e continua
// acessível mesmo com o teste encerrado. Tudo é filtrado no servidor pelo plano e pelos módulos da sessão.

async function contexto(): Promise<core.ContextoOnboarding> {
  const sessao = await exigirSessaoAction();
  return { usuarioId: sessao.usuarioId, empresaId: sessao.empresaId, papel: sessao.papel, modulos: sessao.modulos, recursos: await obterRecursosDaEmpresa(sessao.empresaId) };
}

const tourSchema = z.object({ estado: z.enum(["nao_iniciado", "em_andamento", "concluido", "pulado"]), passo: z.number().int().min(0).max(30) }).strict();

/** Leve, vai em toda página. */
export async function obterTourOnboarding(): Promise<ResultadoAction<TourComAjudas>> {
  return executar(async () => core.estadoDoTour(await contexto()));
}

export async function obterChecklistOnboarding(): Promise<ResultadoAction<ChecklistOnboarding>> {
  return executar(async () => core.estadoDoChecklist(await contexto()));
}

export async function atualizarTourOnboarding(entrada: unknown): Promise<ResultadoAction<null>> {
  return executar(async () => {
    const ctx = await contexto();
    const parsed = tourSchema.safeParse(entrada);
    if (!parsed.success) throw new ErroDeNegocio("Dados do tour inválidos.");
    await core.atualizarTour(ctx, parsed.data);
    return null;
  });
}

export async function ocultarChecklistOnboarding(oculto: boolean): Promise<ResultadoAction<null>> {
  return executar(async () => {
    const ctx = await contexto();
    if (typeof oculto !== "boolean") throw new ErroDeNegocio("Escolha inválida.");
    await core.definirChecklistOculto(ctx, oculto);
    return null;
  });
}

export async function registrarTutorialVisto(chave: string): Promise<ResultadoAction<null>> {
  return executar(async () => {
    const ctx = await contexto();
    await core.registrarAjudaVista(ctx, chave);
    return null;
  });
}
