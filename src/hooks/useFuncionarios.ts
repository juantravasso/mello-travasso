import { useCallback, useEffect, useState } from "react";
import type { FiltrosFuncionario, Funcionario, NovoFuncionarioInput } from "@/types";
import { funcionariosRepositorio } from "@/services/data";

export function useFuncionarios(filtros?: FiltrosFuncionario) {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [carregando, setCarregando] = useState(true);

  const filtrosChave = JSON.stringify(filtros ?? {});

  const recarregar = useCallback(async () => {
    setCarregando(true);
    setFuncionarios(await funcionariosRepositorio.listar(JSON.parse(filtrosChave)));
    setCarregando(false);
  }, [filtrosChave]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  const criarFuncionario = useCallback(
    async (input: NovoFuncionarioInput) => {
      const novo = await funcionariosRepositorio.criar(input);
      await recarregar();
      return novo;
    },
    [recarregar],
  );

  return { funcionarios, carregando, recarregar, criarFuncionario };
}
