"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { FatiaCategoria } from "@/lib/dashboardMetrics";
import { formatarMoeda } from "@/lib/formatadores";

const PALETA = ["#d8a53d", "#4f9ee8", "#22c55e", "#ef4444", "#a78bfa", "#2dd4bf", "#8992a6"];

export function GastosCategoriaChart({ dados }: { dados: FatiaCategoria[] }) {
  const total = dados.reduce((soma, d) => soma + d.valor, 0);

  if (total === 0) {
    return <p className="py-10 text-center text-sm text-muted">Sem gastos registrados ainda.</p>;
  }

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative h-[180px] w-[180px] flex-shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={dados} dataKey="valor" nameKey="rotulo" innerRadius={55} outerRadius={80} paddingAngle={2}>
              {dados.map((_, indice) => (
                <Cell key={indice} fill={PALETA[indice % PALETA.length]} stroke="var(--color-card)" />
              ))}
            </Pie>
            <Tooltip
              formatter={(valor) => formatarMoeda(Number(valor))}
              contentStyle={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                color: "var(--foreground)",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[11px] text-muted">Total</span>
          <span className="text-sm font-semibold text-foreground">{formatarMoeda(total)}</span>
        </div>
      </div>

      <ul className="flex flex-1 flex-col gap-2 text-sm">
        {dados.map((fatia, indice) => (
          <li key={fatia.categoria} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-muted">
              <span
                className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                style={{ backgroundColor: PALETA[indice % PALETA.length] }}
              />
              {fatia.rotulo}
            </span>
            <span className="font-medium text-foreground">{formatarMoeda(fatia.valor)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
