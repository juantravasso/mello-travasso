import { useCallback, useEffect, useState } from "react";
import type { OpcaoPersonalizada, TipoConta } from "@/types";
import { catalogoRepositorio } from "@/services/data";
import {
  categoriasPagar,
  categoriasReceber,
  formasPagamento,
  rotulosCategoriaPagar,
  rotulosCategoriaReceber,
  rotulosFormaPagamento,
} from "@/lib/categorias";

export interface OpcaoCatalogo {
  valor: string;
  rotulo: string;
}

function useCatalogoBase(
  padrao: string[],
  rotulosPadrao: Record<string, string>,
  listar: () => Promise<OpcaoPersonalizada[]>,
  criarOpcao: (rotulo: string) => Promise<OpcaoPersonalizada>,
) {
  const [personalizadas, setPersonalizadas] = useState<OpcaoPersonalizada[]>([]);

  const recarregar = useCallback(async () => {
    setPersonalizadas(await listar());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  const opcoes: OpcaoCatalogo[] = [
    ...padrao.map((valor) => ({ valor, rotulo: rotulosPadrao[valor] ?? valor })),
    ...personalizadas.map((p) => ({ valor: p.id, rotulo: p.rotulo })),
  ];

  function rotuloDe(valor?: string): string {
    if (!valor) return "";
    return rotulosPadrao[valor] ?? personalizadas.find((p) => p.id === valor)?.rotulo ?? valor;
  }

  async function criar(rotulo: string): Promise<string> {
    const nova = await criarOpcao(rotulo);
    await recarregar();
    return nova.id;
  }

  return { opcoes, rotuloDe, criar };
}

export function useCatalogoCategorias(tipo: TipoConta) {
  const padrao = tipo === "pagar" ? categoriasPagar : categoriasReceber;
  const rotulosPadrao = tipo === "pagar" ? rotulosCategoriaPagar : rotulosCategoriaReceber;
  return useCatalogoBase(
    padrao,
    rotulosPadrao,
    () => catalogoRepositorio.listarCategorias(tipo),
    (rotulo) => catalogoRepositorio.criarCategoria(tipo, { rotulo }),
  );
}

export function useCatalogoFormasPagamento() {
  return useCatalogoBase(
    formasPagamento,
    rotulosFormaPagamento,
    () => catalogoRepositorio.listarFormasPagamento(),
    (rotulo) => catalogoRepositorio.criarFormaPagamento({ rotulo }),
  );
}
