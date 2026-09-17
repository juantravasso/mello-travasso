export interface ItemProduto {
  id: string;
  contaFinanceiraId: string;
  obraId: string;
  descricao: string;
  quantidade: number;
  unidade?: string; // ex.: "un", "kg", "m3", "saco"
  valorUnitario: number;
  valorTotal: number;
  dataCompra: string; // ISO date
  fornecedor?: string;
  criadoEm: string; // ISO datetime
}

export type NovoItemProdutoInput = Omit<ItemProduto, "id" | "criadoEm">;

export interface HistoricoPrecoProduto {
  descricaoNormalizada: string;
  ocorrencias: ItemProduto[];
  menorPreco: number;
  maiorPreco: number;
  precoMedio: number;
  ultimaCompra: ItemProduto;
}

export interface FiltrosItemProduto {
  descricao?: string;
  obraId?: string;
  fornecedor?: string;
  dataInicio?: string;
  dataFim?: string;
}
