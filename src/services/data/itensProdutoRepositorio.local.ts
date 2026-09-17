import type {
  FiltrosItemProduto,
  HistoricoPrecoProduto,
  ItemProduto,
  NovoItemProdutoInput,
} from "@/types";
import { agoraISO, gerarId, lerBanco, salvarBanco } from "./localDb";
import type { ItensProdutoRepositorio } from "./repositorios";

export function normalizarDescricao(descricao: string): string {
  return descricao
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function corresponde(item: ItemProduto, filtros?: FiltrosItemProduto): boolean {
  if (!filtros) return true;
  if (filtros.obraId && item.obraId !== filtros.obraId) return false;
  if (filtros.fornecedor && item.fornecedor !== filtros.fornecedor) return false;
  if (filtros.dataInicio && item.dataCompra < filtros.dataInicio) return false;
  if (filtros.dataFim && item.dataCompra > filtros.dataFim) return false;
  if (filtros.descricao) {
    const alvo = normalizarDescricao(item.descricao);
    if (!alvo.includes(normalizarDescricao(filtros.descricao))) return false;
  }
  return true;
}

export class ItensProdutoRepositorioLocal implements ItensProdutoRepositorio {
  async listar(filtros?: FiltrosItemProduto): Promise<ItemProduto[]> {
    return lerBanco()
      .itensProduto.filter((item) => corresponde(item, filtros))
      .sort((a, b) => b.dataCompra.localeCompare(a.dataCompra));
  }

  async criarEmLote(itens: NovoItemProdutoInput[]): Promise<ItemProduto[]> {
    const banco = lerBanco();
    const agora = agoraISO();
    const novos: ItemProduto[] = itens.map((item) => ({
      ...item,
      id: gerarId("item"),
      criadoEm: agora,
    }));
    banco.itensProduto.push(...novos);
    salvarBanco(banco);
    return novos;
  }

  async historicoPorDescricao(descricao: string): Promise<HistoricoPrecoProduto | null> {
    const alvo = normalizarDescricao(descricao);
    const ocorrencias = lerBanco()
      .itensProduto.filter((item) => normalizarDescricao(item.descricao) === alvo)
      .sort((a, b) => a.dataCompra.localeCompare(b.dataCompra));

    if (ocorrencias.length === 0) return null;

    const valores = ocorrencias.map((item) => item.valorUnitario);
    const ultimaCompra = ocorrencias[ocorrencias.length - 1];
    if (!ultimaCompra) return null;

    return {
      descricaoNormalizada: alvo,
      ocorrencias,
      menorPreco: Math.min(...valores),
      maiorPreco: Math.max(...valores),
      precoMedio: valores.reduce((soma, v) => soma + v, 0) / valores.length,
      ultimaCompra,
    };
  }

  async listarDescricoesUnicas(): Promise<string[]> {
    const vistos = new Map<string, string>();
    for (const item of lerBanco().itensProduto) {
      const chave = normalizarDescricao(item.descricao);
      if (!vistos.has(chave)) vistos.set(chave, item.descricao);
    }
    return Array.from(vistos.values()).sort((a, b) => a.localeCompare(b));
  }
}
