"use client";

import { useState } from "react";
import type { GaleriaPublica } from "@/types";
import { formatarDataBr } from "@/lib/rede/texto";
import { Badge } from "@/components/ui/Badge";
import { ImageLightbox } from "@/components/ui/ImageLightbox";

/** Portfólio público: trabalhos agrupados por galeria, com fotos que abrem ampliadas. */
export function GaleriaTrabalhos({ galerias }: { galerias: GaleriaPublica[] }) {
  const [ampliada, setAmpliada] = useState<{ url: string; alt: string } | null>(null);

  return (
    <div className="flex flex-col gap-8">
      {galerias.map((galeria, i) => (
        <div key={galeria.nome ?? `sem-galeria-${i}`} className="flex flex-col gap-4">
          {galeria.nome && <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">{galeria.nome}</h3>}
          <div className="grid gap-4 sm:grid-cols-2">
            {galeria.trabalhos.map((trabalho) => (
              <article key={trabalho.id} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
                {trabalho.fotos.length > 0 && (
                  <div className={trabalho.fotos.length === 1 ? "grid" : "grid grid-cols-2 gap-1.5"}>
                    {trabalho.fotos.map((arquivoId, indice) => (
                      <button
                        key={arquivoId}
                        type="button"
                        onClick={() => setAmpliada({ url: `/api/arquivos/${arquivoId}`, alt: `${trabalho.titulo}, foto ${indice + 1}` })}
                        className="relative aspect-[4/3] overflow-hidden rounded-lg bg-surface-2 focus-visible:outline-2 focus-visible:outline-primary"
                        aria-label={`Ampliar foto ${indice + 1} de ${trabalho.titulo}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/api/arquivos/${arquivoId}`}
                          alt={`${trabalho.titulo}, foto ${indice + 1}`}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex flex-col gap-1">
                  <h4 className="font-medium text-foreground">{trabalho.titulo}</h4>
                  <div className="flex flex-wrap items-center gap-2">
                    {trabalho.servico && <Badge tom="neutral">{trabalho.servico}</Badge>}
                    {trabalho.dataTrabalho && (
                      <span className="text-xs text-muted tabular-nums">{formatarDataBr(`${trabalho.dataTrabalho}T12:00:00Z`)}</span>
                    )}
                  </div>
                  {trabalho.descricao && <p className="whitespace-pre-line text-sm text-foreground/90">{trabalho.descricao}</p>}
                </div>
              </article>
            ))}
          </div>
        </div>
      ))}
      {ampliada && <ImageLightbox url={ampliada.url} alt={ampliada.alt} onFechar={() => setAmpliada(null)} />}
    </div>
  );
}
