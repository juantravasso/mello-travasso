"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useBarraLateral } from "./BarraLateralContext";
import { IconeBusca, IconeMenu } from "./icones";
import { SinoNotificacoes } from "./SinoNotificacoes";
import { SeletorTema } from "./SeletorTema";

function dataDeHoje(): string {
  return new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}

export function Topbar({ nomeUsuario }: { nomeUsuario: string }) {
  // Evita mismatch de hidratação: a data só é calculada no cliente, após o mount.
  const [data, setData] = useState<string | null>(null);
  const { menuMovelAberto, abrirMenuMovel } = useBarraLateral();

  useEffect(() => {
    setData(dataDeHoje());
  }, []);

  return (
    <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-background/80 px-3 py-2 backdrop-blur md:gap-4 md:px-8 md:py-3">
      {/* Celular: o hambúrguer abre o menu lateral com todas as abas (no computador a barra lateral já fica à esquerda). */}
      <button
        type="button"
        onClick={abrirMenuMovel}
        aria-label="Abrir menu"
        aria-expanded={menuMovelAberto}
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-primary md:hidden"
      >
        <IconeMenu className="h-6 w-6" />
      </button>

      <div className="ml-auto flex min-w-0 items-center gap-2 md:gap-4">
        <Link
          href="/rede"
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-primary sm:px-4"
        >
          <IconeBusca className="h-4 w-4 flex-shrink-0" />
          <span className="sm:hidden">Profissionais</span>
          <span className="hidden sm:inline">Encontrar profissionais</span>
        </Link>
        <span className="hidden text-sm capitalize text-muted lg:inline">{data}</span>
        <SeletorTema />
        <SinoNotificacoes />
        <Link
          href="/configuracoes"
          aria-label={`${nomeUsuario}: abrir configurações`}
          className="flex h-10 min-w-0 items-center gap-2 rounded-lg px-1 transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-primary sm:pr-3"
        >
          <span aria-hidden className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
            {nomeUsuario.slice(0, 1).toUpperCase()}
          </span>
          <span className="hidden max-w-[10rem] truncate text-sm font-medium text-foreground sm:inline">{nomeUsuario}</span>
        </Link>
      </div>
    </header>
  );
}
