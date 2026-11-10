import { useCallback, useMemo, useState } from "react";
import type { ContaFinanceira } from "@/types";

/**
 * Seleção de contas para ações em lote. Só contas em aberto podem ser marcadas (as demais não têm baixa a dar) e a
 * seleção acompanha a lista: conta que saiu do filtro deixa de contar, mesmo que continue marcada por baixo.
 */
export function useSelecaoContas(contas: ContaFinanceira[]) {
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());

  const selecionaveis = useMemo(() => contas.filter((c) => c.status === "em_aberto"), [contas]);
  const selecionadas = useMemo(() => selecionaveis.filter((c) => marcadas.has(c.id)), [selecionaveis, marcadas]);
  const todasMarcadas = selecionaveis.length > 0 && selecionadas.length === selecionaveis.length;

  const alternar = useCallback((id: string) => {
    setMarcadas((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }, []);

  const alternarTodas = useCallback(() => {
    setMarcadas(todasMarcadas ? new Set() : new Set(selecionaveis.map((c) => c.id)));
  }, [todasMarcadas, selecionaveis]);

  const limpar = useCallback(() => setMarcadas(new Set()), []);

  const total = useMemo(() => Math.round(selecionadas.reduce((s, c) => s + c.valor, 0) * 100) / 100, [selecionadas]);

  return { marcadas, selecionadas, selecionaveis, todasMarcadas, total, alternar, alternarTodas, limpar };
}
