import { useCallback, useEffect, useState } from "react";
import type { BaixarContaInput, CancelarContaInput, ContaFinanceira, NovaContaFinanceiraInput } from "@/types";
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

  const darBaixa = useCallback(async (input: BaixarContaInput) => {
    const atualizada = await contasRepositorio.baixar(input);
    setConta(atualizada);
    return atualizada;
  }, []);

  const cancelar = useCallback(async (input: CancelarContaInput) => {
    const resultado = await contasRepositorio.cancelar(input);
    setConta(resultado.conta);
    return resultado;
  }, []);

  const atualizar = useCallback(
    async (input: Partial<NovaContaFinanceiraInput>) => {
      const atualizada = await contasRepositorio.atualizar(id, input);
      setConta(atualizada);
      return atualizada;
    },
    [id],
  );

  return { conta, carregando, darBaixa, cancelar, atualizar };
}
