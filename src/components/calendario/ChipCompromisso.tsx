import type { CompromissoItem } from "@/types";
import { COR_CATEGORIA, ROTULO_CATEGORIA } from "@/lib/calendario/categorias";
import { cn } from "@/lib/cn";

/** Compromisso em uma linha, com a cor da categoria. Concluído e cancelado ficam riscados. */
export function ChipCompromisso({ c, aoAbrir, compacto = false }: { c: CompromissoItem; aoAbrir: (c: CompromissoItem) => void; compacto?: boolean }) {
  const hora = c.diaInteiro ? null : c.horaInicio;
  return (
    <button
      type="button"
      onClick={() => aoAbrir(c)}
      title={c.conta ? `${c.titulo}${c.conta.atrasada ? " (vencida)" : ""}` : `${c.titulo} · ${ROTULO_CATEGORIA[c.categoria]}`}
      className={cn(
        "flex w-full min-w-0 items-center gap-1.5 rounded-md px-1.5 text-left text-xs font-medium transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-primary",
        compacto ? "min-h-6 py-0.5" : "min-h-8 py-1",
        c.conta ? (c.conta.tipo === "pagar" ? "bg-danger-bg text-danger" : "bg-success-bg text-success") : COR_CATEGORIA[c.categoria].chip,
        c.status !== "agendado" && "opacity-60",
      )}
    >
      {hora && <span className="flex-shrink-0 tabular-nums opacity-80">{hora}</span>}
      <span className={cn("truncate", c.status !== "agendado" && "line-through")}>{c.titulo}</span>
      {c.status === "concluido" && <span className="sr-only">(concluído)</span>}
      {c.status === "cancelado" && <span className="sr-only">(cancelado)</span>}
      {c.conta?.atrasada && <span className="sr-only">(vencida)</span>}
      {!c.souCriador && <span className="sr-only">(compartilhado com você)</span>}
    </button>
  );
}
