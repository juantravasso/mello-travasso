import { useCallback, useEffect, useState } from "react";
import type { NovoProdutoInput, ProdutoComSaldo } from "@/types";
import { estoqueRepositorio } from "@/services/data";

export function useEstoque() {
  const [produtos, setProdutos] = useState<ProdutoComSaldo[]>([]);
  const [carregando, setCarregando] = useState(true);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    setProdutos(await estoqueRepositorio.listarProdutos());
    setCarregando(false);
  }, []);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  const criarProduto = useCallback(
    async (input: NovoProdutoInput) => {
      const novo = await estoqueRepositorio.criarProduto(input);
      await recarregar();
      return novo;
    },
    [recarregar],
  );

  return { produtos, carregando, recarregar, criarProduto };
}
