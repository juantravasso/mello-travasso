// Depósito: o estoque central da empresa. Material comprado para o Depósito não é custo de projeto até ser transferido.

/** Última compra de um produto (entrada por item de nota fiscal). */
export interface UltimaCompra {
  valorUnitario: number;
  data: string; // ISO datetime
  fornecedor?: string;
}

/** Quanto do produto está em cada local (Depósito ou projeto). */
export interface SaldoNoLocal {
  obraId: string;
  quantidade: number;
}

export interface ProdutoNoDeposito {
  produtoId: string;
  nome: string;
  unidade?: string;
  categoria?: string;
  estoqueMinimo?: number;
  /** Quantidade no Depósito. */
  quantidade: number;
  /** Quanto resta em cada projeto (sem o Depósito), para ver para onde o material já foi. */
  nosProjetos: SaldoNoLocal[];
  ultimaCompra?: UltimaCompra;
  /** Valor unitário usado nas transferências: o da última compra ou, sem compra, o custo médio (0 se nenhum dos dois). */
  valorUnitario: number;
  /** Valor do que está no Depósito, ao valor unitário acima. */
  valorEmEstoque: number;
  /** De onde veio o valor unitário usado nas contas acima. */
  origemDoValor: "ultima_compra" | "custo_medio" | "sem_valor";
  abaixoDoMinimo: boolean;
}

export interface VisaoDeposito {
  depositoId: string;
  produtos: ProdutoNoDeposito[];
  valorTotalEmEstoque: number;
  /** Quantos produtos com saldo no Depósito. */
  totalProdutos: number;
  /** Itens com saldo mas sem nenhum valor conhecido: a transferência deles entra no projeto a R$ 0,00. */
  semValor: number;
}

export type SentidoTransferencia = "para_projeto" | "devolucao";

export interface NovaTransferenciaInput {
  produtoId: string;
  /** O projeto envolvido (nunca o Depósito): destino na ida, origem na devolução. */
  obraId: string;
  /** Padrão: "para_projeto" (Depósito → projeto). "devolucao" traz o material de volta ao Depósito. */
  sentido?: SentidoTransferencia;
  quantidade: number;
  observacao?: string;
}

export interface TransferenciaDeposito {
  /** Identifica a transferência (liga a saída do Depósito e a entrada no projeto). */
  id: string;
  produtoId: string;
  produtoNome: string;
  unidade?: string;
  /** O projeto envolvido. */
  obraId: string;
  sentido: SentidoTransferencia;
  quantidade: number;
  valorUnitario: number;
  /** quantidade × valorUnitario: soma ao gasto do projeto na ida e abate na devolução. */
  custo: number;
  lancadoPor: string;
  observacao?: string;
  criadoEm: string;
}
