import { useEffect, useState } from "react";

const CONSULTA_DESKTOP = "(min-width: 768px)";

/**
 * true quando a tela é larga o suficiente para ser considerada "computador"
 * (breakpoint md do Tailwind). Começa em false (igual ao servidor, que não
 * tem window) para não gerar mismatch de hidratação; o valor real chega
 * logo após o mount.
 */
export function useIsDesktop(): boolean {
  const [desktop, setDesktop] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(CONSULTA_DESKTOP);
    setDesktop(mql.matches);
    const ouvir = (e: MediaQueryListEvent) => setDesktop(e.matches);
    mql.addEventListener("change", ouvir);
    return () => mql.removeEventListener("change", ouvir);
  }, []);

  return desktop;
}
