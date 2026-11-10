"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { formatarDataBr } from "@/lib/rede/texto";
import { Badge } from "@/components/ui/Badge";

export interface TrabalhoParaModal {
  titulo: string;
  servico?: string;
  dataTrabalho?: string;
  descricao?: string;
  /** Ids dos arquivos das fotos, na ordem de exibição. */
  fotos: string[];
}

/**
 * Trabalho realizado em janela própria: a foto grande com setas e miniaturas, e embaixo o título, o serviço, a data e
 * a descrição completa. Esc, o X ou o toque no fundo fecham; a página atrás não rola.
 */
export function TrabalhoFotosModal({ trabalho, inicial, aoFechar }: { trabalho: TrabalhoParaModal; inicial: number; aoFechar: () => void }) {
  const [indice, setIndice] = useState(inicial);
  const [montado, setMontado] = useState(false);
  const total = trabalho.fotos.length;

  useEffect(() => setMontado(true), []);

  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") aoFechar();
      if (total > 1 && e.key === "ArrowRight") setIndice((i) => (i + 1) % total);
      if (total > 1 && e.key === "ArrowLeft") setIndice((i) => (i - 1 + total) % total);
    }
    document.addEventListener("keydown", aoTeclar);
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.body.style.overflow = anterior;
    };
  }, [aoFechar, total]);

  if (!montado || total === 0) return null;
  const atual = trabalho.fotos[indice] ?? trabalho.fotos[0]!;
  const seta =
    "absolute top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-2xl leading-none text-white hover:bg-black/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white";

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/80 sm:items-center sm:p-6" onClick={aoFechar} role="dialog" aria-modal="true" aria-label={trabalho.titulo}>
      <div
        className="flex max-h-[94dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative flex-shrink-0 bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/arquivos/${atual}`} alt={`${trabalho.titulo}, foto ${indice + 1} de ${total}`} className="mx-auto max-h-[55dvh] w-full object-contain" />
          <button
            type="button"
            onClick={aoFechar}
            aria-label="Fechar"
            className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-2xl leading-none text-white hover:bg-black/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
          >
            ×
          </button>
          {total > 1 && (
            <>
              <button type="button" aria-label="Foto anterior" onClick={() => setIndice((i) => (i - 1 + total) % total)} className={`${seta} left-3`}>
                ‹
              </button>
              <button type="button" aria-label="Próxima foto" onClick={() => setIndice((i) => (i + 1) % total)} className={`${seta} right-3`}>
                ›
              </button>
              <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs text-white tabular-nums">
                {indice + 1} / {total}
              </span>
            </>
          )}
        </div>

        {total > 1 && (
          <ul className="flex flex-shrink-0 gap-2 overflow-x-auto border-b border-border bg-surface-2 p-2">
            {trabalho.fotos.map((id, i) => (
              <li key={id} className="flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setIndice(i)}
                  aria-label={`Ver foto ${i + 1}`}
                  aria-current={i === indice ? "true" : undefined}
                  className={`h-14 w-14 overflow-hidden rounded-md border-2 ${i === indice ? "border-primary" : "border-transparent opacity-70 hover:opacity-100"}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/arquivos/${id}`} alt="" className="h-full w-full object-cover" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex min-h-0 flex-col gap-2 overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <h3 className="text-lg font-semibold text-foreground">{trabalho.titulo}</h3>
          {(trabalho.servico || trabalho.dataTrabalho) && (
            <div className="flex flex-wrap items-center gap-2">
              {trabalho.servico && <Badge tom="neutral">{trabalho.servico}</Badge>}
              {trabalho.dataTrabalho && <span className="text-xs text-muted tabular-nums">{formatarDataBr(`${trabalho.dataTrabalho}T12:00:00Z`)}</span>}
            </div>
          )}
          {trabalho.descricao && <p className="whitespace-pre-line break-words text-sm text-foreground/90">{trabalho.descricao}</p>}
        </div>
      </div>
    </div>,
    document.body,
  );
}
