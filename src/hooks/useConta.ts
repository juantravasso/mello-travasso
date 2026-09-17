import { useCallback, useEffect, useState } from "react";
import type { BaixarContaInput, ContaFinanceira } from "@/types";
import { contasRepositorio } from "@/services/data";

export function useConta(id: string) {
  const [conta, setConta] = useState<ContaFinanceira | null>(null);
  const [carregando, setCarregando] = useState(true);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    setConta(await contasRepositorio.obterPorId(id));
    setCarregando(false);
  }, [id]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  const darBaixa = useCallback(
    async (input: BaixarContaInput) => {
      const atualizada = await contasRepositorio.baixar(input);
      setConta(atualizada);
      return atualizada;
    },
    [],
  );

  return { conta, carregando, darBaixa };
}
