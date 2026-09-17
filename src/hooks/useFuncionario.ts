import { useCallback, useEffect, useState } from "react";
import type { Funcionario, NovoFuncionarioInput, StatusFuncionario } from "@/types";
import { funcionariosRepositorio } from "@/services/data";

export function useFuncionario(id: string) {
  const [funcionario, setFuncionario] = useState<Funcionario | null>(null);
  const [carregando, setCarregando] = useState(true);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    setFuncionario(await funcionariosRepositorio.obterPorId(id));
    setCarregando(false);
  }, [id]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  const atualizar = useCallback(async (input: Partial<NovoFuncionarioInput>) => {
    const atualizado = await funcionariosRepositorio.atualizar(id, input);
    setFuncionario(atualizado);
    return atualizado;
  }, [id]);

  const definirStatus = useCallback(async (status: StatusFuncionario) => {
    const atualizado = await funcionariosRepositorio.definirStatus(id, status);
    setFuncionario(atualizado);
    return atualizado;
  }, [id]);

  return { funcionario, carregando, atualizar, definirStatus };
}
