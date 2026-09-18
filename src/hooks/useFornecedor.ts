import { useCallback, useEffect, useState } from "react";
import type { Fornecedor, NovoFornecedorInput } from "@/types";
import { fornecedoresRepositorio } from "@/services/data";

export function useFornecedor(id: string) {
  const [fornecedor, setFornecedor] = useState<Fornecedor | null>(null);
  const [carregando, setCarregando] = useState(true);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    setFornecedor(await fornecedoresRepositorio.obterPorId(id));
    setCarregando(false);
  }, [id]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  const atualizar = useCallback(
    async (input: Partial<NovoFornecedorInput>) => {
      const atualizado = await fornecedoresRepositorio.atualizar(id, input);
      setFornecedor(atualizado);
      return atualizado;
    },
    [id],
  );

  return { fornecedor, carregando, atualizar };
}
