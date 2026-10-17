"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

const CHAVE = "barra-lateral-expandida";

interface BarraLateralValor {
  expandida: boolean;
  alternar: () => void;
}

const Contexto = createContext<BarraLateralValor>({ expandida: false, alternar: () => {} });

export function useBarraLateral(): BarraLateralValor {
  return useContext(Contexto);
}

/** Guarda se a barra lateral está aberta (ícones + nomes) ou recolhida (só ícones); lembra a escolha neste navegador. */
export function BarraLateralProvider({ children }: { children: ReactNode }) {
  // Começa recolhida no servidor e no primeiro render do cliente; a preferência salva entra logo depois.
  const [expandida, setExpandida] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(CHAVE) === "1") setExpandida(true);
    } catch {
      // Armazenamento bloqueado: a barra só não lembra a escolha.
    }
  }, []);

  const alternar = useCallback(() => {
    setExpandida((atual) => {
      const proximo = !atual;
      try {
        localStorage.setItem(CHAVE, proximo ? "1" : "0");
      } catch {
        // idem
      }
      return proximo;
    });
  }, []);

  const valor = useMemo(() => ({ expandida, alternar }), [expandida, alternar]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

/** Coluna de conteúdo: abre espaço para a barra lateral (fixa) na largura em que ela estiver. */
export function ColunaPrincipal({ children }: { children: ReactNode }) {
  const { expandida } = useBarraLateral();
  return (
    <div
      className={cn(
        "flex min-h-full min-w-0 flex-1 flex-col transition-[margin] duration-200 motion-reduce:transition-none",
        expandida ? "md:ml-60" : "md:ml-[68px]",
      )}
    >
      {children}
    </div>
  );
}
