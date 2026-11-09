export type StatusCompra = "rascunho" | "efetivada" | "cancelada";

export interface ParcelaCompra {
  valor: number;
  dataVencimento: string; // ISO date
}

export interface ItemCompra {
  /** Id do item já gravado; ausente em item novo na tela. */
  id?: string;
  descricao: string;
  codigoFornecedor?: string;
  ncm?: string;
  unidade?: string;
  quantidade: number;
  valorUnitario: number;
  desconto: number;
  valorTotal: number;
  /** Projeto ou Depósito para onde o item vai. */
  obraId: string;
  /** Produto do catálogo identificado para este item. */
  produtoId?: string;
}

export interface CompraResumo {
  id: string;
  numero: number;
  status: StatusCompra;
  origem: "foto" | "manual";
  dataCompra: string;
  dataEmissao?: string;
  numeroNf?: string;
  fornecedorNome: string;
  valorTotal: number;
  quantidadeItens: number;
  itensSemProduto: number;
  parcelas: number;
  /** Quanto das parcelas ainda está em aberto / já foi pago (só compra efetivada). */
  vencimentosAbertos: number;
  vencimentosPagos: number;
}

export interface CompraDetalhe extends Omit<CompraResumo, "quantidadeItens" | "itensSemProduto" | "parcelas" | "vencimentosAbertos" | "vencimentosPagos"> {
  fornecedorId?: string;
  serie?: string;
  chaveAcesso?: string;
  obraId: string;
  categoria?: string;
  formaPagamento?: string;
  frete: number;
  seguro: number;
  outrasDespesas: number;
  descontoTotal: number;
  valorProdutos: number;
  parcelas: ParcelaCompra[];
  observacao?: string;
  comprovanteUrl: string;
  contaFinanceiraId?: string;
  motivoCancelamento?: string;
  itens: ItemCompra[];
}

export interface EntradaCompra {
  origem: "foto" | "manual";
  fornecedorId?: string;
  fornecedorNome: string;
  numeroNf?: string;
  serie?: string;
  chaveAcesso?: string;
  dataEmissao?: string;
  dataCompra: string;
  obraId: string;
  categoria?: string;
  formaPagamento?: string;
  frete: number;
  seguro: number;
  outrasDespesas: number;
  parcelas?: ParcelaCompra[];
  observacao?: string;
  comprovanteUrl: string;
  itens: ItemCompra[];
}

export interface FiltrosCompra {
  busca?: string;
  de?: string;
  ate?: string;
  status?: StatusCompra;
}

export interface ListaCompras {
  compras: CompraResumo[];
  totais: { quantidade: number; valorCompras: number; valorAberto: number; valorPago: number };
}

/** Como um item da compra casou com o catálogo. */
export type MotivoSugestao = "vinculo" | "nome" | "parecido";

export interface SugestaoProduto {
  produtoId: string;
  produtoNome: string;
  motivo: MotivoSugestao;
}

export interface EntradaSugestao {
  fornecedorId?: string;
  fornecedorNome?: string;
  itens: { descricao: string; codigoFornecedor?: string }[];
}

export interface ResultadoEfetivacao {
  compraId: string;
  contasCriadas: number;
}
