import { useCallback, useEffect, useState } from "react";
import type { NovaTransferenciaInput, TransferenciaDeposito, VisaoDeposito } from "@/types";
import { depositoRepositorio } from "@/services/data";

export function useDeposito() {
  const [visao, setVisao] = useState<VisaoDeposito | null>(null);
  const [transferencias, setTransferencias] = useState<TransferenciaDeposito[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    const [resultadoVisao, resultadoHistorico] = await Promise.all([depositoRepositorio.obter(), depositoRepositorio.listarTransferencias()]);
    if (resultadoVisao.ok) {
      setVisao(resultadoVisao.dados);
      setErro(null);
    } else {
      setErro(resultadoVisao.mensagem);
    }
    setTransferencias(resultadoHistorico.ok ? resultadoHistorico.dados : []);
    setCarregando(false);
  }, []);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  /** Devolve a mensagem de erro (para o modal mostrar) ou null se deu certo; recarrega o Depósito em seguida. */
  const transferir = useCallback(
    async (input: NovaTransferenciaInput): Promise<string | null> => {
      const resultado = await depositoRepositorio.transferir(input);
      if (!resultado.ok) return resultado.mensagem;
      await recarregar();
      return null;
    },
    [recarregar],
  );

  return { visao, transferencias, erro, carregando, recarregar, transferir };
}
