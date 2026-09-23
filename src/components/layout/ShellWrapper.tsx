import type { ReactNode } from "react";
import type { StatusPlano } from "@/lib/auth/plano";
import { BottomNav } from "./BottomNav";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { FaixaTeste } from "./FaixaTeste";
import { StatusPlanoProvider } from "./StatusPlanoContext";

// Só é renderizado dentro de src/app/(app)/layout.tsx agora — quem decide se
// uma rota tem chrome ou não é o route group ((app) tem, (publico) não),
// então este componente não precisa mais checar o pathname.
export function ShellWrapper({
  children,
  nomeUsuario,
  statusPlano,
}: {
  children: ReactNode;
  nomeUsuario: string;
  statusPlano: StatusPlano;
}) {
  return (
    <StatusPlanoProvider status={statusPlano}>
      <div className="flex min-h-full">
        <Sidebar nomeUsuario={nomeUsuario} />
        {/* min-w-0: sem isso, um item flex não encolhe abaixo do min-content dos
            descendentes (ex.: um <select>/<input type="date">), o que forçava
            overflow horizontal da página inteira no mobile. FaixaTeste fica
            dentro desta coluna (não acima do Sidebar, que é fixed) para não
            precisar deslocar o Sidebar quando a faixa aparece/some. */}
        <div className="flex min-h-full min-w-0 flex-1 flex-col md:ml-[68px]">
          <FaixaTeste />
          <Topbar />
          <main className="mx-auto w-full min-w-0 max-w-6xl flex-1 px-4 pb-24 pt-4 md:px-8 md:pb-10 md:pt-6">
            {children}
          </main>
          <BottomNav />
        </div>
      </div>
    </StatusPlanoProvider>
  );
}
