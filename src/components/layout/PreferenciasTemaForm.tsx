"use client";

import { useTema } from "@/hooks/useTema";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { IconeLua, IconeSol } from "./icones";

export function PreferenciasTemaForm() {
  const { tema, definirTema } = useTema();

  return (
    <Card className="flex flex-col gap-3">
      <div>
        <p className="font-medium text-foreground">Aparência</p>
        <p className="text-sm text-muted">Escolha entre o tema escuro (padrão) e o tema claro.</p>
      </div>
      <div className="inline-flex w-full rounded-lg border border-border bg-surface p-1">
        {(
          [
            { valor: "dark" as const, rotulo: "Escuro", Icone: IconeLua },
            { valor: "light" as const, rotulo: "Claro", Icone: IconeSol },
          ]
        ).map(({ valor, rotulo, Icone }) => (
          <button
            key={valor}
            type="button"
            onClick={() => definirTema(valor)}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              tema === valor ? "bg-primary text-primary-foreground" : "text-muted",
            )}
          >
            <Icone className="h-4 w-4" />
            {rotulo}
          </button>
        ))}
      </div>
    </Card>
  );
}
