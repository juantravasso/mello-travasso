export interface Produto {
  id: string;
  nome: string;
  sku?: string;
  categoria?: string;
  unidade?: string; // ex.: "un", "kg", "m3", "saco"
  custoMedio?: number;
  estoqueMinimo?: number;
  observacao?: string;
  criadoEm: string;
  atualizadoEm: string;
}

export type NovoProdutoInput = Omit<Produto, "id" | "custoMedio" | "criadoEm" | "atualizadoEm">;

export interface SaldoPorObra {
  obraId: string;
  quantidade: number;
}

/** Produto com o saldo total (soma de todas as obras) — usado na listagem `/estoque`. */
export interface ProdutoComSaldo extends Produto {
  saldoTotal: number;
}

/** Ficha completa do produto — usada em `/estoque/[id]`. */
export interface ProdutoDetalhado extends Produto {
  saldoTotal: number;
  saldosPorObra: SaldoPorObra[];
}
