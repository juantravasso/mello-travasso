"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { PontoFluxoMensal } from "@/lib/dashboardMetrics";
import { formatarMoeda } from "@/lib/formatadores";

export function FluxoFinanceiroChart({ dados }: { dados: PontoFluxoMensal[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={dados} barGap={4}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
        <XAxis dataKey="mes" stroke="var(--color-muted)" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis
          stroke="var(--color-muted)"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
        />
        <Tooltip
          formatter={(valor) => formatarMoeda(Number(valor))}
          contentStyle={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: 8,
            color: "var(--foreground)",
          }}
          cursor={{ fill: "var(--color-surface-2)" }}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: "var(--color-muted)" }} />
        <Bar dataKey="entradas" name="Entradas" fill="var(--color-success)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="saidas" name="Saídas" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
