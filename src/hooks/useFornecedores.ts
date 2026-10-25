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

  const resolverFornecedor = useCallback(
    async (nome: string, documento?: string) => {
      const resolvido = await fornecedoresRepositorio.resolver(nome, documento);
      await recarregar();
      return resolvido;
    },
    [recarregar],
  );

  const atualizarFornecedor = useCallback(
    async (id: string, input: Partial<NovoFornecedorInput>) => {
      const atualizado = await fornecedoresRepositorio.atualizar(id, input);
      await recarregar();
      return atualizado;
    },
    [recarregar],
  );

  return { fornecedores, carregando, recarregar, criarFornecedor, resolverFornecedor, atualizarFornecedor };
}
