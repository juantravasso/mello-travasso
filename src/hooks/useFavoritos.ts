"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { alternarFavorito, resolverFavoritos, type ResultadoAlternancia } from "@/lib/layout/favoritos";

const CHAVE = "elo:favoritos";
const EVENTO = "elo:favoritos-mudou";

function assinar(aoMudar: () => void): () => void {
  window.addEventListener("storage", aoMudar);
  window.addEventListener(EVENTO, aoMudar);
  return () => {
    window.removeEventListener("storage", aoMudar);
    window.removeEventListener(EVENTO, aoMudar);
  };
}

/** "" = nada salvo (e também o valor no servidor): o snapshot precisa ser comparável, por isso texto e não null. */
function lerSalvo(): string {
  try {
    return window.localStorage.getItem(CHAVE) ?? "";
  } catch {
    return "";
  }
}

/**
 * Abas favoritas da barra de baixo do celular, guardadas neste aparelho. `permitidos` são as rotas que a pessoa pode
 * acessar (plano e módulos); o que deixou de ser permitido some da lista sem apagar a escolha salva.
 */
export function useFavoritos(permitidos: readonly string[]): {
  favoritos: string[];
  alternar: (href: string) => ResultadoAlternancia;
} {
  const salvo = useSyncExternalStore(assinar, lerSalvo, () => "");
  const chavePermitidos = permitidos.join("|");
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `permitidos` entra pela chave em texto, que muda só quando o conteúdo muda.
  const favoritos = useMemo(() => resolverFavoritos(salvo === "" ? null : salvo, permitidos), [salvo, chavePermitidos]);

  const alternar = useCallback(
    (href: string): ResultadoAlternancia => {
      const resultado = alternarFavorito(favoritos, href);
      if (!resultado.limiteAtingido) {
        try {
          window.localStorage.setItem(CHAVE, JSON.stringify(resultado.lista));
        } catch {
          // Sem armazenamento disponível a escolha vale só até recarregar: não é erro.
        }
        window.dispatchEvent(new Event(EVENTO));
      }
      return resultado;
    },
    [favoritos],
  );

  return { favoritos, alternar };
}
