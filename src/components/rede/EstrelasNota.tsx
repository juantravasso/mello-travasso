import { cn } from "@/lib/cn";

const CAMINHO_ESTRELA = "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z";

const TAMANHOS = { sm: "h-4 w-4", md: "h-5 w-5", lg: "h-7 w-7" } as const;

function Linha({ tamanho }: { tamanho: keyof typeof TAMANHOS }) {
  return (
    <span className="flex w-max">
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} viewBox="0 0 24 24" fill="currentColor" aria-hidden className={cn("shrink-0", TAMANHOS[tamanho])}>
          <path d={CAMINHO_ESTRELA} />
        </svg>
      ))}
    </span>
  );
}

/** Estrelas preenchidas proporcionalmente à nota (aceita decimais, ex.: 4,8). */
export function EstrelasNota({ nota, tamanho = "md" }: { nota: number; tamanho?: keyof typeof TAMANHOS }) {
  const limitada = Math.max(0, Math.min(5, nota));
  return (
    <span
      role="img"
      aria-label={`Nota ${limitada.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} de 5`}
      className="relative inline-flex"
    >
      <span className="text-muted/40">
        <Linha tamanho={tamanho} />
      </span>
      <span className="absolute inset-y-0 left-0 overflow-hidden text-primary" style={{ width: `${(limitada / 5) * 100}%` }}>
        <Linha tamanho={tamanho} />
      </span>
    </span>
  );
}

export function formatarNota(nota: number): string {
  return nota.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}
