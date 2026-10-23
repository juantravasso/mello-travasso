"use client";

import { useState } from "react";
import { BENEFICIO_INSTALACAO, GUIAS, type Plataforma } from "@/lib/onboarding/instalacao";
import { useAmbienteApp } from "@/hooks/useAmbienteApp";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";

const ORDEM: readonly Plataforma[] = ["ios", "android"];

/**
 * Passo a passo para colocar o ícone na tela de início, para iPhone e Android. Abre já no aparelho da pessoa; quem está
 * no computador vê os dois e um aviso para abrir a página no celular. Se o site já roda como aplicativo, só confirma.
 */
export function InstalarNoCelular() {
  const ambiente = useAmbienteApp();
  const [escolhida, setEscolhida] = useState<Plataforma | null>(null);

  const detectada: Plataforma = ambiente.plataforma === "android" ? "android" : "ios";
  const atual = escolhida ?? detectada;
  const guia = GUIAS[atual];
  const noComputador = ambiente.plataforma === "outro";

  return (
    <Card className="flex flex-col gap-4" id="instalar">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold text-foreground">Instale o Elo no seu celular</h2>
          <p className="text-sm text-muted">{BENEFICIO_INSTALACAO}</p>
        </div>
        {ambiente.instalado && <Badge tom="success">Já instalado neste aparelho</Badge>}
      </div>

      {noComputador && <p className="rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-foreground">Para instalar, abra esta mesma página no navegador do seu celular. Os passos de cada aparelho estão abaixo.</p>}

      <div role="group" aria-label="Escolha o seu aparelho" className="flex gap-2">
        {ORDEM.map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={p === atual}
            onClick={() => setEscolhida(p)}
            className={cn(
              "h-10 rounded-lg border px-4 text-sm font-medium transition-colors",
              p === atual ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:bg-surface-2",
            )}
          >
            {GUIAS[p].rotulo}
          </button>
        ))}
      </div>

      {ambiente.iosForaDoSafari && atual === "ios" && (
        <p role="note" className="rounded-md border border-warning/40 bg-warning-bg px-3 py-2 text-sm text-warning">
          Você parece estar fora do Safari. Copie o endereço desta página e abra no Safari para seguir os passos.
        </p>
      )}

      <ol className="flex flex-col gap-3" aria-label={`Passos para instalar no ${guia.rotulo}`}>
        {guia.passos.map((passo, i) => (
          <li key={passo} className="flex items-start gap-3 text-sm text-foreground">
            <span aria-hidden className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold tabular-nums text-foreground">
              {i + 1}
            </span>
            <span className="pt-0.5">{passo}</span>
          </li>
        ))}
      </ol>

      <p className="text-xs text-muted">{guia.observacao}</p>
    </Card>
  );
}
