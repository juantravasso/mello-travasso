import type { RateioDaConta } from "./contaFinanceira";

// Captura de documento (foto de comprovante ou nota fiscal) gravada de uma vez no servidor.

export interface ItemCapturado {
  descricao: string;
  quantidade: number;
  unidade?: string;
  valorUnitario: number;
  valorTotal: number;
  /** Para onde o material foi: um projeto ou o Depósito. */
  obraId: string;
}

export interface ParcelaCapturada {
  valor: number;
  dataVencimento: string; // ISO date
}

export interface EntradaCaptura {
  tipoDocumento: "comprovante" | "nota_fiscal";
  /** Projeto (ou Depósito, só em nota fiscal) da conta. Numa nota com itens, o destino com a maior parte vira o projeto da conta. */
  obraId: string;
  valor: number;
  data: string; // ISO date
  favorecido: string;
  fornecedorId?: string;
  descricao: string;
  categoria?: string;
  formaPagamento?: string;
  observacao?: string;
  comprovanteUrl: string;
  itens: ItemCapturado[];
  parcelas?: ParcelaCapturada[];
}

export interface ResultadoCaptura {
  /** A primeira (ou única) conta criada. */
  contaId: string;
  contasCriadas: number;
  itensCriados: number;
  /** Como o valor da nota foi dividido, quando houve mais de um destino. */
  rateios?: RateioDaConta[];
}
