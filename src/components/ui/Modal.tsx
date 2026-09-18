"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface ModalProps {
  titulo: string;
  onFechar: () => void;
  children: ReactNode;
  /** "lg" dá mais espaço lateral no desktop — use em formulários com vários campos. */
  tamanho?: "md" | "lg";
}

const DURACAO_SAIDA_MS = 140;

const LARGURAS: Record<NonNullable<ModalProps["tamanho"]>, string> = {
  md: "max-w-md",
  lg: "max-w-md md:max-w-2xl",
};

export function Modal({ titulo, onFechar, children, tamanho = "md" }: ModalProps) {
  const [saindo, setSaindo] = useState(false);
  // Só usa o portal depois de montar no client — evita mismatch de hidratação,
  // já que document.body não existe durante o SSR.
  const [montado, setMontado] = useState(false);

  useEffect(() => {
    setMontado(true);
  }, []);

  useEffect(() => {
    function aoTeclarEsc(e: KeyboardEvent) {
      if (e.key === "Escape") fechar();
    }
    document.addEventListener("keydown", aoTeclarEsc);
    return () => document.removeEventListener("keydown", aoTeclarEsc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function fechar() {
    if (saindo) return;
    setSaindo(true);
    window.setTimeout(onFechar, DURACAO_SAIDA_MS);
  }

  if (!montado) return null;

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4",
        saindo ? "animar-modal-backdrop-saida" : "animar-modal-backdrop-entrada",
      )}
      onClick={fechar}
      role="dialog"
      aria-modal
    >
      <div
        className={cn(
          `flex max-h-[85vh] w-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-lg ${LARGURAS[tamanho]}`,
          saindo ? "animar-modal-painel-saida" : "animar-modal-painel-entrada",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-border p-5 pb-4">
          <h2 className="text-lg font-semibold text-foreground">{titulo}</h2>
          <button
            type="button"
            onClick={fechar}
            aria-label="Fechar"
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            ×
          </button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
