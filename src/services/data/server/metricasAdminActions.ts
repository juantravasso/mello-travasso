"use server";

import { z } from "zod";
import { exigirAdminAction } from "@/lib/auth/dal";
import { PERIODOS_METRICAS } from "@/lib/metricas/formulas";
import type { MetricasPlataforma, ResultadoAction } from "@/types";
import { calcularMetricas } from "./metricasCore.server";
import { ErroDeNegocio, executar } from "./resultado.server";

// Painel de métricas: só leitura e só para administrador. O período vem do cliente, então é validado contra a lista.

const periodoSchema = z.number().int().refine((n) => (PERIODOS_METRICAS as readonly number[]).includes(n), "Período inválido.");

export async function obterMetricasPlataforma(periodoDias: number): Promise<ResultadoAction<MetricasPlataforma>> {
  await exigirAdminAction();
  return executar(async () => {
    const parsed = periodoSchema.safeParse(periodoDias);
    if (!parsed.success) throw new ErroDeNegocio("Período inválido.");
    return calcularMetricas(parsed.data);
  });
}
