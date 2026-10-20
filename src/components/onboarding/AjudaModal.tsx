"use client";

import { useEffect } from "react";
import Link from "next/link";
import type { ConteudoAjuda } from "@/lib/onboarding/ajuda";
import { registrarTutorialVisto } from "@/services/data/server/onboardingActions";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{titulo}</h3>
      {children}
    </section>
  );
}

/** "Como funciona?" de um módulo: o que é, problema, benefícios, passo a passo, exemplo e a próxima ação. */
export function AjudaModal({ ajuda, onFechar }: { ajuda: ConteudoAjuda; onFechar: () => void }) {
  // Abrir o tutorial conta como visto (uma vez por pessoa e tutorial; repetir não conta de novo). Falha não atrapalha a leitura.
  useEffect(() => {
    registrarTutorialVisto(ajuda.chave).catch(() => undefined);
  }, [ajuda.chave]);

  return (
    <Modal titulo={`Como funciona: ${ajuda.titulo}`} tamanho="lg" onFechar={onFechar}>
      <div className="flex flex-col gap-5 text-sm leading-relaxed text-foreground">
        <Secao titulo="O que é">
          <p>{ajuda.oQueE}</p>
        </Secao>
        <Secao titulo="Qual problema resolve">
          <p>{ajuda.problema}</p>
        </Secao>
        <Secao titulo="O que você ganha">
          <ul className="flex flex-col gap-1.5">
            {ajuda.beneficios.map((b) => (
              <li key={b} className="flex gap-2">
                <span aria-hidden className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </Secao>
        <Secao titulo="Como usar">
          <ol className="flex flex-col gap-2">
            {ajuda.passos.map((p, i) => (
              <li key={p} className="flex gap-3">
                <span aria-hidden className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold tabular-nums text-foreground">
                  {i + 1}
                </span>
                <span className="pt-0.5">{p}</span>
              </li>
            ))}
          </ol>
        </Secao>
        <Secao titulo="Exemplo prático">
          <p className="rounded-lg bg-surface-2 p-3 text-muted">{ajuda.exemplo}</p>
        </Secao>
        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
          <Link href={ajuda.acao.href} onClick={onFechar}>
            <Button type="button">{ajuda.acao.rotulo}</Button>
          </Link>
          <Button type="button" variante="ghost" onClick={onFechar}>
            Fechar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
