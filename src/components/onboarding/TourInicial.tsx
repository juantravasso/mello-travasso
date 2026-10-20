"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { EstadoTour, TourOnboarding } from "@/types";
import { atualizarTourOnboarding, obterTourOnboarding } from "@/services/data/server/onboardingActions";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

/** Evento que a página Ajuda dispara para reabrir o tour. `detail.desdeInicio` volta ao primeiro passo. */
export const EVENTO_ABRIR_TOUR = "elo:abrir-tour";

/**
 * Tour inicial guiado. Os passos já chegam filtrados pelo servidor (plano e módulos da pessoa). Abre sozinho só para
 * quem acabou de se cadastrar e nunca mais insiste: fechar guarda o ponto onde parou ("em andamento"), pular guarda
 * "pulado", e o tour pode ser retomado ou revisto em Ajuda e tutoriais.
 */
export function TourInicial() {
  const router = useRouter();
  const [tour, setTour] = useState<TourOnboarding | null>(null);
  const [aberto, setAberto] = useState(false);
  const [passo, setPasso] = useState(0);
  // O Modal registra o atalho ESC uma vez só: o fechamento precisa ler o passo e o estado atuais por referência.
  const atualRef = useRef({ passo: 0, estado: "nao_iniciado" as EstadoTour });
  useEffect(() => {
    atualRef.current = { passo, estado: tour?.estado ?? "nao_iniciado" };
  });

  // Guarda o estado no servidor; falha de rede não atrapalha a navegação do tour.
  const guardar = useCallback((estado: EstadoTour, novoPasso: number) => {
    setTour((t) => (t ? { ...t, estado, passo: novoPasso } : t));
    atualizarTourOnboarding({ estado, passo: novoPasso }).catch(() => undefined);
  }, []);

  useEffect(() => {
    let ativo = true;
    obterTourOnboarding()
      .then((r) => {
        if (!ativo || !r.ok) return;
        setTour(r.dados.tour);
        if (r.dados.tour.abrirAutomaticamente) {
          setPasso(0);
          setAberto(true);
          atualizarTourOnboarding({ estado: "em_andamento", passo: 0 }).catch(() => undefined);
        }
      })
      .catch(() => undefined);
    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    function reabrir(e: Event) {
      if (!tour) return;
      const desdeInicio = (e as CustomEvent<{ desdeInicio?: boolean }>).detail?.desdeInicio !== false;
      const inicio = desdeInicio || tour.estado !== "em_andamento" ? 0 : tour.passo;
      setPasso(inicio);
      setAberto(true);
      guardar("em_andamento", inicio);
    }
    window.addEventListener(EVENTO_ABRIR_TOUR, reabrir);
    return () => window.removeEventListener(EVENTO_ABRIR_TOUR, reabrir);
  }, [tour, guardar]);

  if (!aberto || !tour || tour.passos.length === 0) return null;
  const passos = tour.passos;
  const atual = passos[Math.min(passo, passos.length - 1)]!;
  const ultimo = passo >= passos.length - 1;

  function irPara(novo: number) {
    setPasso(novo);
    guardar("em_andamento", novo);
  }

  return (
    <Modal
      titulo={atual.titulo}
      onFechar={() => {
        // Fechar não é pular: guarda onde parou para retomar depois.
        const { passo: passoAtual, estado } = atualRef.current;
        if (estado !== "concluido" && estado !== "pulado") guardar("em_andamento", passoAtual);
        setAberto(false);
      }}
    >
      <div className="flex flex-col gap-5">
        <p className="text-sm leading-relaxed text-foreground">{atual.texto}</p>
        {atual.acao && (
          <div>
            <Button
              type="button"
              variante="outline"
              tamanho="sm"
              onClick={() => {
                guardar("em_andamento", passo);
                setAberto(false);
                router.push(atual.acao!.href);
              }}
            >
              {atual.acao.rotulo}
            </Button>
          </div>
        )}
        <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
          <div className="flex items-center gap-1.5" aria-label={`Passo ${passo + 1} de ${passos.length}`} role="img">
            {passos.map((p, i) => (
              <span key={p.id} className={cn("h-1.5 rounded-full transition-all", i === passo ? "w-5 bg-primary" : "w-1.5 bg-border")} />
            ))}
          </div>
          <span className="text-xs tabular-nums text-muted">
            {passo + 1} de {passos.length}
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            type="button"
            variante="ghost"
            tamanho="sm"
            onClick={() => {
              guardar("pulado", passo);
              setAberto(false);
            }}
          >
            Pular tour
          </Button>
          <div className="flex gap-2">
            {passo > 0 && (
              <Button type="button" variante="outline" tamanho="sm" onClick={() => irPara(passo - 1)}>
                Voltar
              </Button>
            )}
            {ultimo ? (
              <Button
                type="button"
                tamanho="sm"
                onClick={() => {
                  guardar("concluido", passo);
                  setAberto(false);
                }}
              >
                Concluir
              </Button>
            ) : (
              <Button type="button" tamanho="sm" onClick={() => irPara(passo + 1)}>
                Próximo
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
