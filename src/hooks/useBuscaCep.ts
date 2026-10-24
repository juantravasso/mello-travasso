"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cepCompleto, digitosDoCep, formatarCep } from "@/lib/cep";
import { consultarCep, type EnderecoPorCep } from "@/lib/lookupPublico";

/**
 * Preenche o endereço assim que o CEP chega a 8 dígitos, sem esperar a pessoa sair do campo. `aoDigitar` devolve o
 * texto já com a máscara para o campo mostrar. Se a pessoa continuar mexendo no CEP enquanto a consulta roda, a
 * resposta atrasada é descartada (nunca preenche o endereço de um CEP que já foi trocado).
 */
export function useBuscaCep(aoEncontrar: (endereco: EnderecoPorCep) => void): {
  buscando: boolean;
  aviso: string | null;
  aoDigitar: (valor: string) => string;
} {
  const [buscando, setBuscando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const pedidoAtual = useRef<string | null>(null);
  const ultimoAoEncontrar = useRef(aoEncontrar);

  useEffect(() => {
    ultimoAoEncontrar.current = aoEncontrar;
  });

  const aoDigitar = useCallback((valor: string): string => {
    const formatado = formatarCep(valor);
    setAviso(null);
    if (!cepCompleto(formatado)) {
      pedidoAtual.current = null;
      setBuscando(false);
      return formatado;
    }

    const digitos = digitosDoCep(formatado);
    pedidoAtual.current = digitos;
    setBuscando(true);
    void consultarCep(digitos).then((resultado) => {
      if (pedidoAtual.current !== digitos) return;
      setBuscando(false);
      if (resultado.estado === "ok") ultimoAoEncontrar.current(resultado.endereco);
      else if (resultado.estado === "nao_encontrado") setAviso("Não encontramos esse CEP. Confira os números ou preencha o endereço à mão.");
      else setAviso("Não deu para consultar o CEP agora. Preencha o endereço à mão.");
    });
    return formatado;
  }, []);

  return { buscando, aviso, aoDigitar };
}
