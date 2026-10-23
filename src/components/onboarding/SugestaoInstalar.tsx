"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { useAmbienteApp } from "@/hooks/useAmbienteApp";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

const CHAVE = "elo:instalar-dispensado";
const EVENTO = "elo:instalar-dispensado-mudou";

function assinar(aoMudar: () => void): () => void {
  window.addEventListener("storage", aoMudar);
  window.addEventListener(EVENTO, aoMudar);
  return () => {
    window.removeEventListener("storage", aoMudar);
    window.removeEventListener(EVENTO, aoMudar);
  };
}

function lerDispensado(): boolean {
  try {
    return window.localStorage.getItem(CHAVE) === "1";
  } catch {
    return false;
  }
}

/**
 * Uma única sugestão, depois da primeira ação concluída: aparece só no celular, só se o site ainda não está instalado e
 * some para sempre neste aparelho quando a pessoa dispensa (a decisão é por aparelho, então fica no navegador).
 */
export function SugestaoInstalar() {
  const ambiente = useAmbienteApp();
  // No servidor e na primeira pintura conta como dispensado: nada pisca na tela antes de saber o aparelho.
  const dispensado = useSyncExternalStore(assinar, lerDispensado, () => true);

  const noCelular = ambiente.plataforma === "ios" || ambiente.plataforma === "android";
  if (!noCelular || ambiente.instalado || dispensado) return null;

  function dispensar() {
    try {
      window.localStorage.setItem(CHAVE, "1");
    } catch {
      // Sem armazenamento disponível, a sugestão volta na próxima visita: não é erro.
    }
    window.dispatchEvent(new Event(EVENTO));
  }

  return (
    <Card className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="font-medium text-foreground">Deixe o Elo na tela inicial do seu celular</p>
        <p className="text-sm text-muted">Abre em tela cheia, como um aplicativo, sem digitar o endereço.</p>
      </div>
      <div className="flex gap-2">
        <Link href="/ajuda#instalar">
          <Button type="button" tamanho="sm">
            Ver como fazer
          </Button>
        </Link>
        <Button type="button" tamanho="sm" variante="ghost" onClick={dispensar}>
          Agora não
        </Button>
      </div>
    </Card>
  );
}
