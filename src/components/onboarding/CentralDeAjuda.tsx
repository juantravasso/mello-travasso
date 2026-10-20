"use client";

import { useEffect, useState } from "react";
import type { ConteudoAjuda } from "@/lib/onboarding/ajuda";
import type { TourComAjudas } from "@/types";
import { obterTourOnboarding } from "@/services/data/server/onboardingActions";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { AjudaModal } from "./AjudaModal";
import { EVENTO_ABRIR_TOUR } from "./TourInicial";

/** Todos os tutoriais que a pessoa pode ver e o tour, para acessar de novo quando quiser. */
export function CentralDeAjuda({ ajudas }: { ajudas: ConteudoAjuda[] }) {
  const [aberta, setAberta] = useState<ConteudoAjuda | null>(null);
  const [estado, setEstado] = useState<TourComAjudas | null>(null);

  useEffect(() => {
    let ativo = true;
    obterTourOnboarding()
      .then((r) => ativo && r.ok && setEstado(r.dados))
      .catch(() => undefined);
    return () => {
      ativo = false;
    };
  }, []);

  function abrirTour(desdeInicio: boolean) {
    window.dispatchEvent(new CustomEvent(EVENTO_ABRIR_TOUR, { detail: { desdeInicio } }));
  }

  const visto = new Set(estado?.ajudasVistas ?? []);
  const emAndamento = estado?.tour.estado === "em_andamento";

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium text-foreground">Tour pelo Elo Negócios</p>
          <p className="text-sm text-muted">Um minuto para conhecer as áreas disponíveis para você.</p>
        </div>
        <div className="flex gap-2">
          {emAndamento && (
            <Button type="button" tamanho="sm" onClick={() => abrirTour(false)}>
              Continuar de onde parei
            </Button>
          )}
          <Button type="button" tamanho="sm" variante={emAndamento ? "outline" : "primary"} onClick={() => abrirTour(true)}>
            {estado?.tour.estado === "concluido" || estado?.tour.estado === "pulado" ? "Rever o tour" : emAndamento ? "Recomeçar do início" : "Começar o tour"}
          </Button>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        {ajudas.map((a) => (
          <Card key={a.chave} className="flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-foreground">{a.titulo}</h3>
              {visto.has(a.chave) && <Badge tom="neutral">Visto</Badge>}
            </div>
            <p className="flex-1 text-sm text-muted">{a.oQueE}</p>
            <div>
              <Button type="button" variante="outline" tamanho="sm" onClick={() => setAberta(a)}>
                Como funciona?
              </Button>
            </div>
          </Card>
        ))}
      </div>
      {aberta && <AjudaModal ajuda={aberta} onFechar={() => setAberta(null)} />}
    </div>
  );
}
