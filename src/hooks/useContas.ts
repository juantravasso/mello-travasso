import { useCallback, useEffect, useState } from "react";
import type {
  BaixarContaInput,
  ContaFinanceira,
  FiltrosContaFinanceira,
  NovaContaFinanceiraInput,
  TipoConta,
} from "@/types";
import { contasRepositorio, garantirDadosDeExemplo } from "@/services/data";

export function useContas(tipo: TipoConta, filtros?: FiltrosContaFinanceira) {
  const [contas, setContas] = useState<ContaFinanceira[]>([]);
  const [carregando, setCarregando] = useState(true);

  const filtrosChave = JSON.stringify(filtros ?? {});

  const recarregar = useCallback(async () => {
    setCarregando(true);
    const lista = await contasRepositorio.listar({ ...JSON.parse(filtrosChave), tipo });
    setContas(lista);
    setCarregando(false);
    // filtrosChave é derivado de `filtros` a cada render; usá-lo evita loop infinito
    // quando o chamador passa um objeto literal inline como filtro.
  }, [tipo, filtrosChave]);

  useEffect(() => {
    garantirDadosDeExemplo();
    void recarregar();
  }, [recarregar]);

  const criarConta = useCallback(
    async (input: NovaContaFinanceiraInput, usuario: string) => {
      const nova = await contasRepositorio.criar(input, usuario);
      await recarregar();
      return nova;
    },
    [recarregar],
  );

  const darBaixa = useCallback(
    async (input: BaixarContaInput) => {
      const atualizada = await contasRepositorio.baixar(input);
      await recarregar();
      return atualizada;
    },
    [recarregar],
  );

  return { contas, carregando, recarregar, criarConta, darBaixa };
}
