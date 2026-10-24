"use client";

import { useSyncExternalStore } from "react";
import { detectarPlataforma, ehIosForaDoSafari, type PlataformaDetectada } from "@/lib/onboarding/instalacao";

export interface AmbienteApp {
  /** null no servidor e na primeira pintura: ainda não se sabe em que aparelho a página abriu. */
  plataforma: PlataformaDetectada | null;
  /** O site já está aberto como aplicativo instalado (a pessoa já colocou o ícone na tela de início). */
  instalado: boolean;
  iosForaDoSafari: boolean;
  /** O navegador liberou a janela nativa de instalação (Chrome/Edge no Android e no computador). */
  podeInstalar: boolean;
  /** O navegador sabe abrir o menu de compartilhar (no iPhone, é por onde se chega a "Adicionar à Tela de Início"). */
  podeCompartilhar: boolean;
}

const NO_SERVIDOR: AmbienteApp = { plataforma: null, instalado: false, iosForaDoSafari: false, podeInstalar: false, podeCompartilhar: false };

const CONSULTA_APP = "(display-mode: standalone)";

// O Chrome dispara `beforeinstallprompt` uma vez, cedo, e some se ninguém guardar. O evento fica aqui, fora do React.
interface EventoInstalacao extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let eventoInstalacao: EventoInstalacao | null = null;
const ouvintes = new Set<() => void>();
const avisar = () => ouvintes.forEach((f) => f());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    eventoInstalacao = e as EventoInstalacao;
    avisar();
  });
  window.addEventListener("appinstalled", () => {
    eventoInstalacao = null;
    avisar();
  });
}

/** Abre a janela nativa "Instalar app". O navegador só deixa uma vez por evento, então o evento é descartado depois. */
export async function pedirInstalacao(): Promise<"accepted" | "dismissed" | "indisponivel"> {
  const evento = eventoInstalacao;
  if (!evento) return "indisponivel";
  eventoInstalacao = null;
  avisar();
  await evento.prompt();
  return (await evento.userChoice).outcome;
}

/** Abre o menu de compartilhar do aparelho com o endereço desta página. Falso se foi cancelado ou não existe. */
export async function abrirCompartilhar(): Promise<boolean> {
  if (typeof navigator.share !== "function") return false;
  try {
    await navigator.share({ title: document.title, url: window.location.origin });
    return true;
  } catch {
    return false; // a pessoa fechou o menu
  }
}

let anterior: AmbienteApp | null = null;

function ler(): AmbienteApp {
  const navegador = window.navigator as Navigator & { standalone?: boolean };
  const atual: AmbienteApp = {
    plataforma: detectarPlataforma({ userAgent: navegador.userAgent, platform: navegador.platform, maxTouchPoints: navegador.maxTouchPoints }),
    // No iPhone o modo app também aparece em navigator.standalone.
    instalado: window.matchMedia(CONSULTA_APP).matches || navegador.standalone === true,
    iosForaDoSafari: ehIosForaDoSafari(navegador.userAgent),
    podeInstalar: eventoInstalacao !== null,
    podeCompartilhar: typeof navegador.share === "function",
  };
  // useSyncExternalStore pede o mesmo objeto enquanto nada mudou.
  if (
    anterior &&
    anterior.plataforma === atual.plataforma &&
    anterior.instalado === atual.instalado &&
    anterior.iosForaDoSafari === atual.iosForaDoSafari &&
    anterior.podeInstalar === atual.podeInstalar &&
    anterior.podeCompartilhar === atual.podeCompartilhar
  ) {
    return anterior;
  }
  anterior = atual;
  return atual;
}

function assinar(aoMudar: () => void): () => void {
  const consulta = window.matchMedia(CONSULTA_APP);
  consulta.addEventListener("change", aoMudar);
  ouvintes.add(aoMudar);
  return () => {
    consulta.removeEventListener("change", aoMudar);
    ouvintes.delete(aoMudar);
  };
}

/** Em que aparelho a página abriu e se já está instalada. Estável entre servidor e navegador (sem erro de hidratação). */
export function useAmbienteApp(): AmbienteApp {
  return useSyncExternalStore(assinar, ler, () => NO_SERVIDOR);
}
