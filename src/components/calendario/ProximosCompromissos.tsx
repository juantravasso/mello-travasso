"use client";

import type { CompromissoItem } from "@/types";
import { COR_CATEGORIA } from "@/lib/calendario/categorias";
import { cn } from "@/lib/cn";
import { Card } from "@/components/ui/Card";

function rotuloData(data: string, hoje: string): string {
  const [a, m, d] = data.split("-").map(Number);
  const alvo = Date.UTC(a ?? 0, (m ?? 1) - 1, d ?? 1);
  const [ha, hm, hd] = hoje.split("-").map(Number);
  const dias = Math.round((alvo - Date.UTC(ha ?? 0, (hm ?? 1) - 1, hd ?? 1)) / 86_400_000);
  if (dias === 0) return "Hoje";
  if (dias === 1) return "Amanhã";
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}

/** Lista curta dos próximos compromissos agendados, para consulta rápida. */
export function ProximosCompromissos({
  itens,
  hoje,
  carregando,
  aoAbrir,
}: {
  itens: CompromissoItem[] | null;
  hoje: string;
  carregando: boolean;
  aoAbrir: (c: CompromissoItem) => void;
}) {
  return (
    <Card className="flex flex-col gap-3" aria-labelledby="titulo-proximos">
      <h2 id="titulo-proximos" className="text-sm font-semibold text-foreground">
        Próximos compromissos
      </h2>
      {carregando && !itens ? (
        <div className="h-20 animate-pulse rounded-lg bg-surface-2" aria-busy="true" />
      ) : !itens || itens.length === 0 ? (
        <p className="text-sm text-muted">Nada agendado pela frente.</p>
      ) : (
        <ul className="flex flex-col">
          {itens.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => aoAbrir(c)} className="flex w-full items-start gap-2.5 rounded-lg px-1 py-2 text-left hover:bg-surface-2">
                <span aria-hidden className={cn("mt-1.5 h-2 w-2 flex-shrink-0 rounded-full", COR_CATEGORIA[c.categoria].ponto)} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-foreground">{c.titulo}</span>
                  <span className="block text-xs text-muted tabular-nums">
                    {rotuloData(c.data, hoje)} · {c.diaInteiro ? "dia inteiro" : c.horaInicio}
                    {!c.souCriador && ` · de ${c.criadoPor.nome}`}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
