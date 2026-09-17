import { cn } from "@/lib/cn";

interface LogoProps {
  tamanho?: "sm" | "md" | "lg";
  className?: string;
  comTexto?: boolean;
}

const tamanhoMarca: Record<NonNullable<LogoProps["tamanho"]>, string> = {
  sm: "h-8 w-8 text-sm",
  md: "h-10 w-10 text-base",
  lg: "h-14 w-14 text-xl",
};

const tamanhoTitulo: Record<NonNullable<LogoProps["tamanho"]>, string> = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-lg",
};

export function Logo({ tamanho = "md", className, comTexto = true }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className={cn(
          "flex flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary-hover font-bold text-primary-foreground",
          tamanhoMarca[tamanho],
        )}
      >
        MT
      </div>
      {comTexto && (
        <div className="min-w-0 leading-tight">
          <p className={cn("truncate font-semibold tracking-wide text-foreground", tamanhoTitulo[tamanho])}>
            MELLO E TRAVASSO
          </p>
          <p className="truncate text-[10px] uppercase tracking-widest text-muted">Engenharia Civil</p>
        </div>
      )}
    </div>
  );
}
