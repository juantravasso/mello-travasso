import type { ReactNode } from "react";
import { Rodape } from "@/components/layout/Rodape";
import { RedeHeader } from "@/components/rede/RedeHeader";

// Páginas públicas da rede profissional: abertas a visitantes, sem a barra
// lateral do app (que pertence a (app)). O cabeçalho muda se há sessão.
export default function RedeLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <RedeHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">{children}</main>
      <Rodape />
    </div>
  );
}
