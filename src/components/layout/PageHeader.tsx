import type { ReactNode } from "react";
import { AjudaDaPagina } from "@/components/onboarding/AjudaDaPagina";

export function PageHeader({ titulo, acao }: { titulo: string; acao?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <h1 className="text-xl font-semibold text-foreground">{titulo}</h1>
        <AjudaDaPagina />
      </div>
      {acao}
    </div>
  );
}
