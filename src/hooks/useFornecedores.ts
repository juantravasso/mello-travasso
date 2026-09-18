import { useCallback, useEffect, useState } from "react";
import type { FiltrosFornecedor, Fornecedor, NovoFornecedorInput } from "@/types";
import { fornecedoresRepositorio } from "@/services/data";

export function useFornecedores(filtros?: FiltrosFornecedor) {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [carregando, setCarregando] = useState(true);

  const filtrosChave = JSON.stringify(filtros ?? {});

  const recarregar = useCallback(async () => {
    setCarregando(true);
    setFornecedores(await fornecedoresRepositorio.listar(JSON.parse(filtrosChave)));
    setCarregando(false);
  }, [filtrosChave]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  const criarFornecedor = useCallback(
    async (input: NovoFornecedorInput) => {
      const novo = await fornecedoresRepositorio.criar(input);
      await recarregar();
      return novo;
    },
    [recarregar],
  );

  return { fornecedores, carregando, recarregar, criarFornecedor };
}
