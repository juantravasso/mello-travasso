"use client";

import { useEffect, useState } from "react";
import { SinoNotificacoes } from "./SinoNotificacoes";
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
    <header className="sticky top-0 z-20 flex items-center justify-end gap-3 border-b border-border bg-background/80 px-4 py-2 backdrop-blur md:gap-4 md:px-8 md:py-3">
      <span className="hidden text-sm capitalize text-muted sm:inline">{data}</span>
      <SeletorTema />
      <SinoNotificacoes />
    </header>
  );
}
