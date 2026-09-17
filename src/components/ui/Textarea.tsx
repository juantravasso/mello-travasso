import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  destaque?: boolean;
}

export function Textarea({ label, destaque, className, id, ...props }: TextareaProps) {
  return (
    <label className="flex flex-col gap-1 text-sm" htmlFor={id}>
      {label && <span className="font-medium text-foreground">{label}</span>}
      <textarea
        id={id}
        className={cn(
          "min-h-20 rounded-lg border bg-surface px-3 py-2 text-base text-foreground outline-none transition-colors placeholder:text-muted focus:border-primary",
          destaque ? "border-info bg-info-bg" : "border-border",
          className,
        )}
        {...props}
      />
    </label>
  );
}
