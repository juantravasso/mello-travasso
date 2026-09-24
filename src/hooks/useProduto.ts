import { useCallback, useEffect, useState } from "react";
import type { MovimentoEstoque, NovoMovimentoInput, ProdutoDetalhado } from "@/types";
import { estoqueRepositorio } from "@/services/data";

export function useProduto(id: string) {
  const [produto, setProduto] = useState<ProdutoDetalhado | null>(null);
  const [movimentos, setMovimentos] = useState<MovimentoEstoque[]>([]);
  const [carregando, setCarregando] = useState(true);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    const [dadosProduto, dadosMovimentos] = await Promise.all([
      estoqueRepositorio.obterProdutoPorId(id),
      estoqueRepositorio.listarMovimentos(id),
    ]);
    setProduto(dadosProduto);
    setMovimentos(dadosMovimentos);
    setCarregando(false);
  }, [id]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  const registrarMovimento = useCallback(
    async (input: NovoMovimentoInput) => {
      const movimento = await estoqueRepositorio.registrarMovimento(input);
      await recarregar();
      return movimento;
    },
    [recarregar],
  );

  return { produto, movimentos, carregando, registrarMovimento };
}
