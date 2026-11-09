"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/** Foto ampliada em tela cheia, com setas para as outras fotos da mesma postagem. Esc, toque fora ou o X fecham. */
export function Lightbox({ fotos, inicial, aoFechar }: { fotos: { id: string; url: string }[]; inicial: number; aoFechar: () => void }) {
  const [indice, setIndice] = useState(inicial);
  const [montado, setMontado] = useState(false);
  const total = fotos.length;

  useEffect(() => setMontado(true), []);

  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") aoFechar();
      if (e.key === "ArrowRight") setIndice((i) => (i + 1) % total);
      if (e.key === "ArrowLeft") setIndice((i) => (i - 1 + total) % total);
    }
    document.addEventListener("keydown", aoTeclar);
    // Trava a rolagem da página atrás da foto.
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.body.style.overflow = anterior;
    };
  }, [aoFechar, total]);

  const foto = fotos[indice];
  if (!montado || !foto) return null;

  const botao =
    "absolute flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-2xl leading-none text-white hover:bg-black/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white";

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={`Foto ${indice + 1} de ${total}`} className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4" onClick={aoFechar}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={foto.url} alt={`Foto ${indice + 1} de ${total}`} className="max-h-full max-w-full rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
      <button type="button" aria-label="Fechar foto" onClick={aoFechar} className={`${botao} right-3 top-[max(0.75rem,env(safe-area-inset-top))]`}>
        ×
      </button>
      {total > 1 && (
        <>
          <button
            type="button"
            aria-label="Foto anterior"
            onClick={(e) => {
              e.stopPropagation();
              setIndice((i) => (i - 1 + total) % total);
            }}
            className={`${botao} left-3 top-1/2 -translate-y-1/2`}
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Próxima foto"
            onClick={(e) => {
              e.stopPropagation();
              setIndice((i) => (i + 1) % total);
            }}
            className={`${botao} right-3 top-1/2 -translate-y-1/2`}
          >
            ›
          </button>
          <p className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-sm text-white tabular-nums">
            {indice + 1} / {total}
          </p>
        </>
      )}
    </div>,
    document.body,
  );
}
