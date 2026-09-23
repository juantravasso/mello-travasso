import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  erro?: string;
  destaque?: boolean; // usado para sinalizar campo extraído por IA com baixa confiança
}

export function Input({ label, erro, destaque, className, id, "aria-describedby": ariaDescribedBy, ...props }: InputProps) {
  const idErro = erro && id ? `${id}-erro` : undefined;

  return (
    <label className="flex min-w-0 flex-col gap-1 text-sm" htmlFor={id}>
      {label && <span className="font-medium text-foreground">{label}</span>}
      <input
        id={id}
        aria-invalid={erro ? true : undefined}
        aria-describedby={[idErro, ariaDescribedBy].filter(Boolean).join(" ") || undefined}
        className={cn(
          "h-11 w-full min-w-0 rounded-lg border bg-surface px-3 text-base text-foreground outline-none transition-colors placeholder:text-muted focus:border-primary",
          erro ? "border-danger" : destaque ? "border-info bg-info-bg" : "border-border",
          className,
        )}
        {...props}
      />
      {erro && (
        <span id={idErro} role="alert" className="text-xs text-danger">
          {erro}
        </span>
      )}
      {destaque && !erro && (
        <span className="text-xs text-info">Confira este valor — a IA não teve certeza.</span>
      )}
    </label>
  );
}
