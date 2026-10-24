"use client";

import { useMemo } from "react";
import { podeAcessarRota } from "@/lib/auth/modulos";
import { useAcesso } from "./AcessoContext";
import { ITENS_NAVEGACAO, type ItemNavegacao } from "./navegacao";

/**
 * Abas que esta pessoa vê: só as dos módulos que o dono liberou (o menu esconde, mas a barreira real continua nas
 * Server Actions) e a Administração só para administrador da plataforma.
 */
export function useItensNavegacao(admin: boolean): readonly ItemNavegacao[] {
  const { pessoa } = useAcesso();
  return useMemo(
    () => ITENS_NAVEGACAO.filter((item) => (item.grupo !== "admin" || admin) && podeAcessarRota(pessoa, item.href)),
    [pessoa, admin],
  );
}
