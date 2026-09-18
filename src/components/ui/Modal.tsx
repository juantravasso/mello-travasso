"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import { animate } from "animejs";

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
  const backdropRef = useRef<HTMLDivElement>(null);
  const painelRef = useRef<HTMLDivElement>(null);
  const [saindo, setSaindo] = useState(false);
  // Só usa o portal depois de montar no client — evita mismatch de hidratação,
  // já que document.body não existe durante o SSR.
  const [montado, setMontado] = useState(false);

  useEffect(() => {
    setMontado(true);
  }, []);

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

  if (!montado) return null;

  return createPortal(
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
        className={`flex max-h-[85vh] w-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-lg ${LARGURAS[tamanho]}`}
        style={{ opacity: 0 }}
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
