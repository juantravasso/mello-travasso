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
  /** Produto do catálogo de estoque resolvido/criado a partir da descrição (Fase 5.2). */
  produtoId?: string;
  criadoEm: string; // ISO datetime
}

// produtoId nunca vem do client — é resolvido/criado no servidor a partir da
// descrição (ver resolverProdutoComTx em estoqueActions.ts).
export type NovoItemProdutoInput = Omit<ItemProduto, "id" | "criadoEm" | "produtoId">;

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
