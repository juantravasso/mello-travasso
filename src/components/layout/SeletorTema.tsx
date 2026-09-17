"use client";

import { useTema } from "@/hooks/useTema";
import { IconeLua, IconeSol } from "./icones";

export function SeletorTema() {
  const { tema, alternarTema } = useTema();

  return (
    <button
      type="button"
      onClick={alternarTema}
      aria-label={tema === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
      className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
    >
      {tema === "dark" ? <IconeSol className="h-5 w-5" /> : <IconeLua className="h-5 w-5" />}
    </button>
  );
}
