"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { DenunciaModal } from "./DenunciaModal";

/** Menu de três pontos de cada avaliação. Visitante é levado a entrar; só conta logada denuncia. */
export function MenuAvaliacao({
  avaliacaoId,
  slugDoPerfil,
  logado,
}: {
  avaliacaoId: string;
  slugDoPerfil: string;
  logado: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [denunciando, setDenunciando] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    function aoClicarFora(e: MouseEvent) {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAberto(false);
    }
    function aoTeclarEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setAberto(false);
    }
    document.addEventListener("mousedown", aoClicarFora);
    document.addEventListener("keydown", aoTeclarEsc);
    return () => {
      document.removeEventListener("mousedown", aoClicarFora);
      document.removeEventListener("keydown", aoTeclarEsc);
    };
  }, [aberto]);

  return (
    <div ref={raiz} className="relative ml-auto">
      <button
        type="button"
        aria-label="Mais opções da avaliação"
        aria-haspopup="menu"
        aria-expanded={aberto}
        onClick={() => setAberto((v) => !v)}
        className="flex h-8 w-8 items-center justify-center rounded-full text-lg leading-none text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
      >
        <span aria-hidden>⋯</span>
      </button>
      {aberto && (
        <div
          role="menu"
          className="absolute right-0 top-full z-20 mt-1 w-56 overflow-hidden rounded-lg border border-border bg-card p-1 shadow-lg"
        >
          {logado ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setAberto(false);
                setDenunciando(true);
              }}
              className="flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-foreground hover:bg-surface-2"
            >
              Denunciar avaliação
            </button>
          ) : (
            <Link
              role="menuitem"
              href={`/login?next=${encodeURIComponent(`/empresas/${slugDoPerfil}`)}`}
              className="flex w-full items-center rounded-md px-3 py-2 text-sm text-foreground hover:bg-surface-2"
            >
              Entre para denunciar
            </Link>
          )}
        </div>
      )}
      {denunciando && (
        <DenunciaModal
          alvo={{ tipo: "avaliacao", avaliacaoId }}
          titulo="Denunciar avaliação"
          aoFechar={() => setDenunciando(false)}
        />
      )}
    </div>
  );
}
