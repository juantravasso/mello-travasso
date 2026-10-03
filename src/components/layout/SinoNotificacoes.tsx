"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { redeRepositorio } from "@/services/data";
import { IconeSino } from "./icones";

/** Sino do topo: leva às notificações e mostra quantas ainda não foram lidas. */
export function SinoNotificacoes() {
  const pathname = usePathname();
  const [naoLidas, setNaoLidas] = useState(0);

  useEffect(() => {
    let cancelado = false;
    redeRepositorio
      .contarNotificacoesNaoLidas()
      .then((n) => {
        if (!cancelado) setNaoLidas(n);
      })
      .catch(() => undefined);
    return () => {
      cancelado = true;
    };
    // Reconta a cada navegação (ler uma notificação muda o número).
  }, [pathname]);

  return (
    <Link
      href="/minha-rede/notificacoes"
      aria-label={naoLidas > 0 ? `Notificações, ${naoLidas} não lidas` : "Notificações"}
      className="relative flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
    >
      <IconeSino className="h-5 w-5" />
      {naoLidas > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white tabular-nums">
          {naoLidas > 9 ? "9+" : naoLidas}
        </span>
      )}
    </Link>
  );
}
