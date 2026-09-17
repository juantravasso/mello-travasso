import { useEffect, useState } from "react";

const CHAVE = "mello-travasso:usuario-atual";

/**
 * O sistema não tem login — para registrar "quem fez o quê" no histórico de
 * cada conta, cada navegador guarda o nome de quem está usando ali. Simples
 * e sem senha, pensado para uma equipe pequena e de confiança.
 */
export function useUsuarioAtual() {
  const [usuario, setUsuarioState] = useState("");
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    setUsuarioState(window.localStorage.getItem(CHAVE) ?? "");
    setCarregado(true);
  }, []);

  function definirUsuario(nome: string) {
    const limpo = nome.trim();
    window.localStorage.setItem(CHAVE, limpo);
    setUsuarioState(limpo);
  }

  return { usuario, usuarioOuPadrao: usuario || "Desconhecido", carregado, definirUsuario };
}
