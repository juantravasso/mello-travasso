import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

type VarianteBotao = "primary" | "secondary" | "outline" | "ghost" | "danger";
type TamanhoBotao = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: VarianteBotao;
  tamanho?: TamanhoBotao;
  children: ReactNode;
}

const classesVariante: Record<VarianteBotao, string> = {
  primary: "bg-primary text-primary-foreground shadow-sm shadow-primary/20 hover:bg-primary-hover hover:shadow-md hover:shadow-primary/30",
  secondary: "bg-surface-2 text-foreground hover:bg-border",
  outline: "border border-border bg-transparent text-foreground hover:bg-surface-2",
  ghost: "text-foreground hover:bg-surface-2",
  danger: "bg-danger text-white hover:opacity-90",
};

const classesTamanho: Record<TamanhoBotao, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-4 text-base",
  lg: "h-14 px-6 text-lg",
};

export function Button({
  variante = "primary",
  tamanho = "md",
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100",
        classesVariante[variante],
        classesTamanho[tamanho],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
