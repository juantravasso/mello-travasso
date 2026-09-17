"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { animate } from "animejs";

interface ModalProps {
  titulo: string;
  onFechar: () => void;
  children: ReactNode;
}

const DURACAO_SAIDA_MS = 140;

export function Modal({ titulo, onFechar, children }: ModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const painelRef = useRef<HTMLDivElement>(null);
  const [saindo, setSaindo] = useState(false);

  useEffect(() => {
    if (backdropRef.current) {
      animate(backdropRef.current, { opacity: [0, 1], duration: 160, ease: "outQuad" });
    }
    if (painelRef.current) {
      animate(painelRef.current, { opacity: [0, 1], scale: [0.96, 1], duration: 200, ease: "outQuad" });
    }
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
    if (painelRef.current) {
      animate(painelRef.current, { opacity: [1, 0], scale: [1, 0.97], duration: DURACAO_SAIDA_MS, ease: "inQuad" });
    }
    if (backdropRef.current) {
      animate(backdropRef.current, { opacity: [1, 0], duration: DURACAO_SAIDA_MS, ease: "inQuad" });
    }
    window.setTimeout(onFechar, DURACAO_SAIDA_MS);
  }

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      style={{ opacity: 0 }}
      onClick={fechar}
      role="dialog"
      aria-modal
    >
      <div
        ref={painelRef}
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-lg"
        style={{ opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
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
        {children}
      </div>
    </div>
  );
}
