import { useCallback, useEffect, useMemo, useState } from "react";
import type { NovaObraInput, Obra } from "@/types";
import { obrasRepositorio } from "@/services/data";

/**
 * `obras`: só os projetos (é o que se escolhe em formulários). `locais`: projetos + Depósito, para mostrar o nome
 * de qualquer conta, item ou movimento, que podem apontar para o Depósito.
 */
export function useObras() {
  const [locais, setLocais] = useState<Obra[]>([]);
  const [carregando, setCarregando] = useState(true);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    const lista = await obrasRepositorio.listar();
    setLocais(lista);
    setCarregando(false);
  }, []);

  const obras = useMemo(() => locais.filter((o) => !o.ehDeposito), [locais]);
  const deposito = useMemo(() => locais.find((o) => o.ehDeposito), [locais]);

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

  return { obras, locais, deposito, carregando, recarregar, criarObra };
}
