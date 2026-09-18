import { useCallback, useEffect, useState } from "react";
import type { FiltrosItemProduto, ItemProduto } from "@/types";
import { itensProdutoRepositorio } from "@/services/data";

export function useItensProduto(filtros?: FiltrosItemProduto) {
  const [itens, setItens] = useState<ItemProduto[]>([]);
  const [descricoes, setDescricoes] = useState<string[]>([]);
  const [carregando, setCarregando] = useState(true);

  const filtrosChave = JSON.stringify(filtros ?? {});

  const recarregar = useCallback(async () => {
    setCarregando(true);
    const [lista, listaDescricoes] = await Promise.all([
      itensProdutoRepositorio.listar(JSON.parse(filtrosChave)),
      itensProdutoRepositorio.listarDescricoesUnicas(),
    ]);
    setItens(lista);
    setDescricoes(listaDescricoes);
    setCarregando(false);
  }, [filtrosChave]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  return { itens, descricoes, carregando, recarregar };
}
