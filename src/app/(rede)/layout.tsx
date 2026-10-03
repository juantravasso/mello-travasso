import type { ReactNode } from "react";
import Link from "next/link";
import { RedeHeader } from "@/components/rede/RedeHeader";

// Páginas públicas da rede profissional: abertas a visitantes, sem a barra
// lateral do app (que pertence a (app)). O cabeçalho muda se há sessão.
export default function RedeLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <RedeHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">{children}</main>
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-5xl flex-col gap-1 px-4 py-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>MELLO E TRAVASSO — Rede profissional</span>
          <span className="flex gap-4">
            <Link href="/termos" className="hover:text-foreground">
              Termos
            </Link>
            <Link href="/privacidade" className="hover:text-foreground">
              Privacidade
            </Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
