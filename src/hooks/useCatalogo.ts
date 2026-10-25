import { useCallback, useEffect, useState } from "react";
import type { OpcaoPersonalizada, TipoConta } from "@/types";
import { catalogoRepositorio } from "@/services/data";
import { renomearCategoriaPersonalizada, renomearFormaPagamentoPersonalizada } from "@/services/data/server/catalogoActions";
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
  /** Criada pela empresa (pode ser renomeada). As opções padrão são fixas. */
  personalizada?: boolean;
}

function useCatalogoBase(
  padrao: string[],
  rotulosPadrao: Record<string, string>,
  listar: () => Promise<OpcaoPersonalizada[]>,
  criarOpcao: (rotulo: string) => Promise<OpcaoPersonalizada>,
  renomearOpcao: (id: string, rotulo: string) => Promise<void>,
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
    ...personalizadas.map((p) => ({ valor: p.id, rotulo: p.rotulo, personalizada: true })),
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

  async function renomear(id: string, rotulo: string): Promise<void> {
    await renomearOpcao(id, rotulo);
    await recarregar();
  }

  return { opcoes, rotuloDe, criar, renomear };
}

export function useCatalogoCategorias(tipo: TipoConta) {
  const padrao = tipo === "pagar" ? categoriasPagar : categoriasReceber;
  const rotulosPadrao = tipo === "pagar" ? rotulosCategoriaPagar : rotulosCategoriaReceber;
  return useCatalogoBase(
    padrao,
    rotulosPadrao,
    () => catalogoRepositorio.listarCategorias(tipo),
    (rotulo) => catalogoRepositorio.criarCategoria(tipo, { rotulo }),
    (id, rotulo) => renomearCategoriaPersonalizada(id, { rotulo }),
  );
}

export function useCatalogoFormasPagamento() {
  return useCatalogoBase(
    formasPagamento,
    rotulosFormaPagamento,
    () => catalogoRepositorio.listarFormasPagamento(),
    (rotulo) => catalogoRepositorio.criarFormaPagamento({ rotulo }),
    (id, rotulo) => renomearFormaPagamentoPersonalizada(id, { rotulo }),
  );
}
