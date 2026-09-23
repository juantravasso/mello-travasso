"use client";

import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import type { StatusPlano } from "@/lib/auth/plano";

const StatusPlanoContext = createContext<StatusPlano | null>(null);

export function StatusPlanoProvider({ status, children }: { status: StatusPlano; children: ReactNode }) {
  return <StatusPlanoContext.Provider value={status}>{children}</StatusPlanoContext.Provider>;
}

/**
 * Status do plano da empresa da sessão, calculado uma vez no servidor
 * ((app)/layout.tsx) e distribuído por contexto — evita cada componente de
 * escrita (formulários, botões) buscar isso de novo. É só para a UI reagir
 * (desabilitar botão, mostrar aviso); a barreira real é exigirEscritaAction()
 * no servidor, checado de novo a cada Server Action.
 */
export function useStatusPlano(): StatusPlano {
  const status = useContext(StatusPlanoContext);
  if (!status) {
    // Fora do provider (ex.: engano de import) — trata como liberado, nunca
    // bloqueia a UI por engano; a segurança real está no servidor de qualquer forma.
    return { plano: "ativo", diasRestantes: null, somenteLeitura: false, dataFimFormatada: null };
  }
  return status;
}
