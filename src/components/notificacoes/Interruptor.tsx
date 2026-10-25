import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Interruptor liga/desliga com rótulo e uma linha de apoio. Alvo de toque de 44 px de altura. */
export function Interruptor({
  ligado,
  aoAlternar,
  rotulo,
  apoio,
  desabilitado,
}: {
  ligado: boolean;
  aoAlternar: () => void;
  rotulo: string;
  apoio?: ReactNode;
  desabilitado?: boolean;
}) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{rotulo}</p>
        {apoio && <p className="text-xs text-muted">{apoio}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={ligado}
        aria-label={rotulo}
        disabled={desabilitado}
        onClick={aoAlternar}
        className={cn(
          "relative h-6 w-11 flex-shrink-0 rounded-full border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50",
          ligado ? "border-primary bg-primary" : "border-border bg-surface-2",
        )}
      >
        <span
          aria-hidden
          className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-[left] motion-reduce:transition-none", ligado ? "left-[22px]" : "left-0.5")}
        />
      </button>
    </div>
  );
}
