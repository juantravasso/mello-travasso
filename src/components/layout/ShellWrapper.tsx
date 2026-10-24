import type { ReactNode } from "react";
import type { StatusPlano } from "@/lib/auth/plano";
import type { ModuloChave } from "@/lib/auth/modulos";
import { AcessoProvider } from "./AcessoContext";
import { BarraLateralProvider, ColunaPrincipal } from "./BarraLateralContext";
import { BottomNav } from "./BottomNav";
import { MenuMovel } from "./MenuMovel";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { AvisoEmail } from "./AvisoEmail";
import { FaixaTeste } from "./FaixaTeste";
import { StatusPlanoProvider } from "./StatusPlanoContext";
import { TourInicial } from "@/components/onboarding/TourInicial";

// Só é renderizado dentro de src/app/(app)/layout.tsx agora — quem decide se
// uma rota tem chrome ou não é o route group ((app) tem, (publico) não),
// então este componente não precisa mais checar o pathname.
export function ShellWrapper({
  children,
  nomeUsuario,
  statusPlano,
  temGestao,
  admin,
  emailConfirmado,
  emailUsuario,
  papel,
  modulos,
}: {
  children: ReactNode;
  nomeUsuario: string;
  statusPlano: StatusPlano;
  temGestao: boolean;
  admin: boolean;
  emailConfirmado: boolean;
  emailUsuario: string;
  papel: "dono" | "membro";
  modulos: readonly ModuloChave[];
}) {
  return (
    <StatusPlanoProvider status={statusPlano}>
      <AcessoProvider pessoa={{ papel, modulos }}>
        <BarraLateralProvider>
          <div className="flex min-h-full">
            <Sidebar
              nomeUsuario={nomeUsuario}
              temGestao={temGestao}
              admin={admin}
            />
            <MenuMovel nomeUsuario={nomeUsuario} temGestao={temGestao} admin={admin} />
            {/* min-w-0: sem isso, um item flex não encolhe abaixo do min-content dos
            descendentes (ex.: um <select>/<input type="date">), o que forçava
            overflow horizontal da página inteira no mobile. FaixaTeste fica
            dentro desta coluna (não acima do Sidebar, que é fixed) para não
            precisar deslocar o Sidebar quando a faixa aparece/some. */}
            <ColunaPrincipal>
              {!emailConfirmado && <AvisoEmail email={emailUsuario} />}
              <FaixaTeste />
              <TourInicial />
              <Topbar />
              <main className="mx-auto w-full min-w-0 max-w-6xl flex-1 px-4 pb-24 pt-4 md:px-8 md:pb-10 md:pt-6">
                {children}
              </main>
              <BottomNav temGestao={temGestao} admin={admin} />
            </ColunaPrincipal>
          </div>
        </BarraLateralProvider>
      </AcessoProvider>
    </StatusPlanoProvider>
  );
}
