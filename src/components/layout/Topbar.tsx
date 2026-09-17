"use client";

import { useEffect, useState } from "react";
import { IconeSino } from "./icones";
import { SeletorTema } from "./SeletorTema";

function dataDeHoje(): string {
  return new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}

export function Topbar() {
  // Evita mismatch de hidratação: a data só é calculada no cliente, após o mount.
  const [data, setData] = useState<string | null>(null);

  useEffect(() => {
    setData(dataDeHoje());
  }, []);

  return (
    <header className="sticky top-0 z-20 hidden items-center justify-end gap-4 border-b border-border bg-background/80 px-8 py-3 backdrop-blur md:flex">
      <span className="text-sm capitalize text-muted">{data}</span>
      <SeletorTema />
      <button
        type="button"
        aria-label="Notificações"
        className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
      >
        <IconeSino className="h-5 w-5" />
      </button>
    </header>
  );
}
