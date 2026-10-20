"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { ajudaDaRota } from "@/lib/onboarding/ajuda";
import { useAcesso } from "@/components/layout/AcessoContext";
import { AjudaModal } from "./AjudaModal";

/** Botão "Como funciona?" ao lado do título das telas de cada módulo. Não aparece onde não há ajuda ou o módulo não é da pessoa. */
export function AjudaDaPagina() {
  const pathname = usePathname();
  const { pode } = useAcesso();
  const [aberto, setAberto] = useState(false);
  const ajuda = ajudaDaRota(pathname);
  if (!ajuda || !pode(ajuda.chave)) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        aria-label={`Como funciona: ${ajuda.titulo}`}
        className="inline-flex h-8 flex-shrink-0 items-center gap-1.5 rounded-full border border-border px-2.5 text-sm font-medium text-muted transition-colors hover:border-primary/60 hover:text-foreground"
      >
        <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
          <circle cx="10" cy="10" r="8" />
          <path d="M7.9 7.7a2.2 2.2 0 1 1 3.3 1.9c-.8.5-1.2 1-1.2 1.8M10 14.1h.01" strokeLinecap="round" />
        </svg>
        <span className="hidden sm:inline">Como funciona?</span>
      </button>
      {aberto && <AjudaModal ajuda={ajuda} onFechar={() => setAberto(false)} />}
    </>
  );
}
