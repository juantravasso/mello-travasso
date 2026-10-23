"use client";

import { useSyncExternalStore } from "react";
import { detectarPlataforma, ehIosForaDoSafari, type PlataformaDetectada } from "@/lib/onboarding/instalacao";

export interface AmbienteApp {
  /** null no servidor e na primeira pintura: ainda não se sabe em que aparelho a página abriu. */
  plataforma: PlataformaDetectada | null;
  /** O site já está aberto como aplicativo instalado (a pessoa já colocou o ícone na tela de início). */
  instalado: boolean;
  iosForaDoSafari: boolean;
}

const NO_SERVIDOR: AmbienteApp = { plataforma: null, instalado: false, iosForaDoSafari: false };

const CONSULTA_APP = "(display-mode: standalone)";

let anterior: AmbienteApp | null = null;

function ler(): AmbienteApp {
  const navegador = window.navigator as Navigator & { standalone?: boolean };
  const atual: AmbienteApp = {
    plataforma: detectarPlataforma({ userAgent: navegador.userAgent, platform: navegador.platform, maxTouchPoints: navegador.maxTouchPoints }),
    // No iPhone o modo app também aparece em navigator.standalone.
    instalado: window.matchMedia(CONSULTA_APP).matches || navegador.standalone === true,
    iosForaDoSafari: ehIosForaDoSafari(navegador.userAgent),
  };
  // useSyncExternalStore pede o mesmo objeto enquanto nada mudou.
  if (anterior && anterior.plataforma === atual.plataforma && anterior.instalado === atual.instalado && anterior.iosForaDoSafari === atual.iosForaDoSafari) return anterior;
  anterior = atual;
  return atual;
}

function assinar(aoMudar: () => void): () => void {
  const consulta = window.matchMedia(CONSULTA_APP);
  consulta.addEventListener("change", aoMudar);
  return () => consulta.removeEventListener("change", aoMudar);
}

/** Em que aparelho a página abriu e se já está instalada. Estável entre servidor e navegador (sem erro de hidratação). */
export function useAmbienteApp(): AmbienteApp {
  return useSyncExternalStore(assinar, ler, () => NO_SERVIDOR);
}
