import { useEffect, useState } from "react";

export type Tema = "dark" | "light";

const CHAVE = "mello-travasso:tema";

function aplicarTema(tema: Tema) {
  document.documentElement.setAttribute("data-theme", tema);
}

export function useTema() {
  const [tema, setTemaState] = useState<Tema>("light");

  useEffect(() => {
    const salvo = window.localStorage.getItem(CHAVE) as Tema | null;
    if (salvo === "light" || salvo === "dark") setTemaState(salvo);
  }, []);

  function definirTema(novo: Tema) {
    window.localStorage.setItem(CHAVE, novo);
    aplicarTema(novo);
    setTemaState(novo);
  }

  function alternarTema() {
    definirTema(tema === "light" ? "dark" : "light");
  }

  return { tema, definirTema, alternarTema };
}
