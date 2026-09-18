import { useCallback, useEffect, useState } from "react";
import type { NovaObraInput, Obra } from "@/types";
import { obrasRepositorio } from "@/services/data";

export function useObras() {
  const [obras, setObras] = useState<Obra[]>([]);
  const [carregando, setCarregando] = useState(true);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    const lista = await obrasRepositorio.listar();
    setObras(lista);
    setCarregando(false);
  }, []);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  const criarObra = useCallback(
    async (input: NovaObraInput) => {
      const nova = await obrasRepositorio.criar(input);
      await recarregar();
      return nova;
    },
    [recarregar],
  );

  return { obras, carregando, recarregar, criarObra };
}
