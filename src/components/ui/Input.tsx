"use client";

import { useState, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { IconeOlho, IconeOlhoRiscado } from "@/components/layout/icones";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  erro?: string;
  destaque?: boolean; // usado para sinalizar campo extraído por IA com baixa confiança
}

export function Input({ label, erro, destaque, className, id, type, "aria-describedby": ariaDescribedBy, ...props }: InputProps) {
  const idErro = erro && id ? `${id}-erro` : undefined;
  // Todo campo de senha ganha o olho para mostrar e ocultar o que foi digitado.
  const ehSenha = type === "password";
  const [mostrar, setMostrar] = useState(false);

  const campo = (
    <input
      id={id}
      type={ehSenha && mostrar ? "text" : type}
      aria-invalid={erro ? true : undefined}
      aria-describedby={[idErro, ariaDescribedBy].filter(Boolean).join(" ") || undefined}
      className={cn(
        "h-11 w-full min-w-0 rounded-lg border bg-surface px-3 text-base text-foreground outline-none transition-colors placeholder:text-muted focus:border-primary",
        ehSenha && "pr-12",
        erro ? "border-danger" : destaque ? "border-info bg-info-bg" : "border-border",
        className,
      )}
      {...props}
    />
  );

  return (
    <label className="flex min-w-0 flex-col gap-1 text-sm" htmlFor={id}>
      {label && <span className="font-medium text-foreground">{label}</span>}
      {ehSenha ? (
        <div className="relative">
          {campo}
          <button
            type="button"
            aria-label={mostrar ? "Ocultar senha" : "Mostrar senha"}
            aria-pressed={mostrar}
            onClick={() => setMostrar((v) => !v)}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-muted transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
          >
            {mostrar ? <IconeOlhoRiscado className="h-5 w-5" /> : <IconeOlho className="h-5 w-5" />}
          </button>
        </div>
      ) : (
        campo
      )}
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
