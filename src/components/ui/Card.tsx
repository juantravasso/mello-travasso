import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Card({ className, children, ...props }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-4 shadow-sm shadow-black/20 transition-colors",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
