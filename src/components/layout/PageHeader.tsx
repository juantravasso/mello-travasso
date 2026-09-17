import type { ReactNode } from "react";

export function PageHeader({ titulo, acao }: { titulo: string; acao?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h1 className="text-xl font-semibold text-foreground">{titulo}</h1>
      {acao}
    </div>
  );
}
