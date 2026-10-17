import { cn } from "@/lib/cn";
import { CORES_MARCA, type ChaveProduto } from "@/lib/marca";

interface LogoProps {
  tamanho?: "sm" | "md" | "lg";
  className?: string;
  comTexto?: boolean;
  /** Mostra a área do produto sob o nome (ex.: "Gestão"). Sem ela, só "Elo Negócios". */
  produto?: Exclude<ChaveProduto, "marketplace">;
}

const tamanhoMarca: Record<NonNullable<LogoProps["tamanho"]>, string> = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-14 w-14",
};

const tamanhoTitulo: Record<NonNullable<LogoProps["tamanho"]>, string> = {
  sm: "text-base",
  md: "text-lg",
  lg: "text-2xl",
};

const ROTULO_PRODUTO: Record<NonNullable<LogoProps["produto"]>, string> = {
  gestao: "Gestão",
  profissionais: "Profissionais",
};

// Dois elos de corrente que se atravessam: o de cima passa por cima de um lado e por baixo do outro.
// As cores são da identidade (CORES_MARCA), não do tema, e valem igual no claro e no escuro.
export function SimboloMarca({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true" focusable="false" className={cn("flex-shrink-0", className)}>
      <rect width="40" height="40" rx="9" fill={CORES_MARCA.navy} />
      <g fill="none" strokeWidth="3.2" strokeLinecap="round">
        <rect x="17" y="13.5" width="18" height="13" rx="6.5" stroke={CORES_MARCA.ouro} />
        <rect x="5" y="13.5" width="18" height="13" rx="6.5" stroke={CORES_MARCA.elo} />
        {/* Quarto de arco do elo dourado redesenhado por cima do verde: é ele que cria o entrelaçamento. */}
        <path d="M23.5 13.5A6.5 6.5 0 0 0 17 20" stroke={CORES_MARCA.ouro} />
      </g>
    </svg>
  );
}

export function Logo({ tamanho = "md", className, comTexto = true, produto }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <SimboloMarca className={tamanhoMarca[tamanho]} />
      {comTexto && (
        <div className="min-w-0 leading-tight">
          <p className={cn("truncate tracking-tight text-foreground", tamanhoTitulo[tamanho])}>
            <span className="font-bold">Elo</span> <span className="font-medium">Negócios</span>
          </p>
          {produto && (
            <p className="truncate text-[10px] font-medium uppercase tracking-widest text-muted">{ROTULO_PRODUTO[produto]}</p>
          )}
        </div>
      )}
    </div>
  );
}
