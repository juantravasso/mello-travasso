import { cn } from "@/lib/cn";

const PASSOS = [
  { numero: 1, rotulo: "Capturar" },
  { numero: 2, rotulo: "Revisar" },
  { numero: 3, rotulo: "Confirmar" },
] as const;

export function PassosCaptura({ passoAtual }: { passoAtual: 1 | 2 | 3 }) {
  return (
    <ol className="mb-5 flex items-center">
      {PASSOS.map((passo, indice) => {
        const concluido = passo.numero < passoAtual;
        const ativo = passo.numero === passoAtual;
        return (
          <li key={passo.numero} className="flex flex-1 items-center last:flex-none">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                  concluido && "bg-primary text-primary-foreground",
                  ativo && "bg-primary/15 text-primary ring-2 ring-primary",
                  !concluido && !ativo && "bg-surface-2 text-muted",
                )}
              >
                {concluido ? "✓" : passo.numero}
              </span>
              <span className={cn("text-sm font-medium", ativo ? "text-foreground" : "text-muted")}>
                {passo.rotulo}
              </span>
            </div>
            {indice < PASSOS.length - 1 && (
              <span className={cn("mx-3 h-px flex-1", concluido ? "bg-primary" : "bg-border")} />
            )}
          </li>
        );
      })}
    </ol>
  );
}
