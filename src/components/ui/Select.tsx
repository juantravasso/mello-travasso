import type { ReactNode, SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  children: ReactNode;
}

export function Select({ label, className, id, children, ...props }: SelectProps) {
  return (
    <label className="flex flex-col gap-1 text-sm" htmlFor={id}>
      {label && <span className="font-medium text-foreground">{label}</span>}
      <select
        id={id}
        className={cn(
          "h-11 rounded-lg border border-border bg-surface px-3 text-base text-foreground outline-none transition-colors focus:border-primary",
          className,
        )}
        {...props}
      >
        {children}
      </select>
    </label>
  );
}
