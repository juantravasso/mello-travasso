import Link from "next/link";
import type { ProgressoObra } from "@/lib/dashboardMetrics";
import { formatarMoeda } from "@/lib/formatadores";

export function ProgressoObrasList({ itens }: { itens: ProgressoObra[] }) {
  if (itens.length === 0) return <p className="text-sm text-muted">Nenhuma obra em andamento.</p>;

  return (
    <ul className="flex flex-col gap-4">
      {itens.map(({ obra, gasto, percentual }) => (
        <li key={obra.id}>
          <Link href={`/obras/${obra.id}`} className="group flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate font-medium text-foreground group-hover:text-primary">
                {obra.nome}
              </span>
              <span className="flex-shrink-0 text-muted">{percentual !== null ? `${percentual.toFixed(0)}%` : "—"}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${percentual ?? 0}%` }}
              />
            </div>
            <span className="text-xs text-muted">
              {formatarMoeda(gasto)}
              {obra.orcamentoPrevisto ? ` / ${formatarMoeda(obra.orcamentoPrevisto)}` : ""}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
