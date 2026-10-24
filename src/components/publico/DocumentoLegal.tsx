import type { ReactNode } from "react";
import { Logo } from "@/components/layout/Logo";
import { DATA_TERMOS_ATUAL, VERSAO_TERMOS_ATUAL } from "@/lib/termos";

/** Casca comum dos Termos e da Política: logo, título, versão e coluna de leitura. */
export function DocumentoLegal({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-svh max-w-2xl flex-col gap-8 px-6 py-12">
      <Logo tamanho="md" />
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.01em] text-foreground">{titulo}</h1>
          <p className="mt-1 text-sm text-muted">
            Versão {VERSAO_TERMOS_ATUAL} · {DATA_TERMOS_ATUAL}
          </p>
        </div>
        <div className="flex flex-col gap-6 text-sm leading-relaxed text-foreground">{children}</div>
      </div>
    </main>
  );
}

export function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-base font-semibold">{titulo}</h2>
      {children}
    </section>
  );
}

export function Lista({ children }: { children: ReactNode }) {
  return <ul className="ml-5 flex list-disc flex-col gap-1.5">{children}</ul>;
}
