"use client";

import { useEffect, useState } from "react";
import { normalizarBusca } from "@/lib/rede/texto";
import { sugerirCidades } from "@/services/data/server/redeActions";

/**
 * Sugestões de cidade (tabela de municípios do IBGE) para um campo com datalist.
 * `desconhecida` só fica true depois que a consulta do texto atual voltou sem nenhum município de
 * mesmo nome — nunca enquanto a consulta ainda está em andamento.
 */
export function useSugestoesCidade(estado: string | undefined, cidade: string) {
  const [resposta, setResposta] = useState<{ chave: string; lista: string[] }>({ chave: "", lista: [] });
  const termo = cidade.trim();
  const chave = `${estado ?? ""}|${termo}`;

  useEffect(() => {
    if (termo.length < 2) return;
    let cancelado = false;
    const espera = setTimeout(() => {
      sugerirCidades(estado || undefined, termo)
        .then((lista) => {
          if (!cancelado) setResposta({ chave, lista });
        })
        .catch(() => {
          if (!cancelado) setResposta({ chave: "", lista: [] });
        });
    }, 250);
    return () => {
      cancelado = true;
      clearTimeout(espera);
    };
  }, [chave, estado, termo]);

  const atual = termo.length >= 2 && resposta.chave === chave;
  const sugestoes = termo.length >= 2 ? resposta.lista : [];
  const desconhecida = atual && !sugestoes.some((s) => normalizarBusca(s) === normalizarBusca(termo));
  return { sugestoes, desconhecida };
}
