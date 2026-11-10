"use client";

import { useState } from "react";
import type { GaleriaPublica } from "@/types";
import { formatarDataBr } from "@/lib/rede/texto";
import { TrabalhoFotosModal, type TrabalhoParaModal } from "./TrabalhoFotosModal";

const MAX_MINIATURAS = 3;

/**
 * Portfólio público: trabalhos agrupados por galeria. Cada cartão tem uma foto de capa grande, miniaturas das demais,
 * título, serviço e um resumo; tocar em qualquer parte abre o trabalho completo em janela própria.
 */
export function GaleriaTrabalhos({ galerias }: { galerias: GaleriaPublica[] }) {
  const [aberto, setAberto] = useState<{ trabalho: TrabalhoParaModal; indice: number } | null>(null);

  return (
    <div className="flex flex-col gap-8">
      {galerias.map((galeria, i) => (
        <div key={galeria.nome ?? `sem-galeria-${i}`} className="flex flex-col gap-4">
          {galeria.nome && <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">{galeria.nome}</h3>}
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {galeria.trabalhos.map((trabalho) => {
              const paraModal: TrabalhoParaModal = {
                titulo: trabalho.titulo,
                servico: trabalho.servico ?? undefined,
                dataTrabalho: trabalho.dataTrabalho ?? undefined,
                descricao: trabalho.descricao ?? undefined,
                fotos: trabalho.fotos,
              };
              const [capa, ...resto] = trabalho.fotos;
              const miniaturas = resto.slice(0, MAX_MINIATURAS);
              const escondidas = resto.length - miniaturas.length;
              return (
                <article
                  key={trabalho.id}
                  className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card transition-shadow focus-within:shadow-lg hover:shadow-lg"
                >
                  {capa && (
                    <div className="flex flex-col gap-1 bg-surface-2 p-1.5">
                      <button
                        type="button"
                        onClick={() => setAberto({ trabalho: paraModal, indice: 0 })}
                        aria-label={`Ampliar foto de ${trabalho.titulo}`}
                        className="relative block aspect-[16/10] w-full overflow-hidden rounded-xl bg-surface-2"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/api/arquivos/${capa}`}
                          alt={`${trabalho.titulo}, foto 1`}
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        />
                        {trabalho.fotos.length > 1 && (
                          <span className="absolute bottom-2 right-2 rounded-full bg-black/65 px-2 py-0.5 text-xs font-medium text-white tabular-nums">
                            {trabalho.fotos.length} fotos
                          </span>
                        )}
                      </button>
                      {miniaturas.length > 0 && (
                        <div className="grid grid-cols-3 gap-1">
                          {miniaturas.map((arquivoId, k) => {
                            const ultima = k === miniaturas.length - 1 && escondidas > 0;
                            return (
                              <button
                                key={arquivoId}
                                type="button"
                                onClick={() => setAberto({ trabalho: paraModal, indice: k + 1 })}
                                aria-label={`Ampliar foto ${k + 2} de ${trabalho.titulo}`}
                                className="relative block aspect-[4/3] overflow-hidden rounded-lg bg-surface-2"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={`/api/arquivos/${arquivoId}`} alt={`${trabalho.titulo}, foto ${k + 2}`} loading="lazy" className="h-full w-full object-cover" />
                                {ultima && <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-sm font-semibold text-white">+{escondidas}</span>}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex flex-1 flex-col gap-2 p-4">
                    <h4 className="break-words text-base font-semibold leading-snug text-foreground">{trabalho.titulo}</h4>
                    {(trabalho.servico || trabalho.dataTrabalho) && (
                      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                        {trabalho.servico && (
                          <span className="max-w-full truncate rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary" title={trabalho.servico}>
                            {trabalho.servico}
                          </span>
                        )}
                        {trabalho.dataTrabalho && (
                          <span className="text-xs text-muted tabular-nums">{formatarDataBr(`${trabalho.dataTrabalho}T12:00:00Z`)}</span>
                        )}
                      </div>
                    )}
                    {trabalho.descricao && <p className="line-clamp-3 whitespace-pre-line break-words text-sm text-muted">{trabalho.descricao}</p>}
                    <button
                      type="button"
                      onClick={() => setAberto({ trabalho: paraModal, indice: 0 })}
                      className="mt-auto w-fit pt-1 text-sm font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary"
                    >
                      {trabalho.fotos.length > 0 ? "Ver trabalho completo" : "Ver detalhes"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      ))}
      {aberto && <TrabalhoFotosModal trabalho={aberto.trabalho} inicial={aberto.indice} aoFechar={() => setAberto(null)} />}
    </div>
  );
}
