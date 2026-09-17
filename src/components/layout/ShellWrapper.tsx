"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BottomNav } from "./BottomNav";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

// A landing page ("/") é uma tela cheia de marketing, sem navegação do app.
const ROTAS_SEM_CHROME = ["/"];

export function ShellWrapper({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (ROTAS_SEM_CHROME.includes(pathname)) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-full">
      <Sidebar />
      {/* min-w-0: sem isso, um item flex não encolhe abaixo do min-content dos
          descendentes (ex.: um <select>/<input type="date">), o que forçava
          overflow horizontal da página inteira no mobile. */}
      <div className="flex min-h-full min-w-0 flex-1 flex-col md:ml-64">
        <Topbar />
        <main className="mx-auto w-full min-w-0 max-w-6xl flex-1 px-4 pb-24 pt-4 md:px-8 md:pb-10 md:pt-6">
          {children}
        </main>
        <BottomNav />
      </div>
    </div>
  );
}
