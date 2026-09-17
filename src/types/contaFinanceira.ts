export type TipoConta = "pagar" | "receber";
export type StatusConta = "em_aberto" | "baixada";

export type CategoriaGasto =
  | "material"
  | "mao_de_obra"
  | "equipamento"
  | "transporte"
  | "servico_terceirizado"
  | "taxa_licenca"
  | "outros";

export interface ContaFinanceira {
  id: string;
  tipo: TipoConta;
  obraId: string;
  valor: number;
  dataVencimento: string; // ISO date — data prevista (pagamento ou recebimento)
  dataBaixa?: string; // ISO date — quando efetivamente paga/recebida
  status: StatusConta;
  favorecidoOuCliente: string;
  descricao: string;
  categoria?: CategoriaGasto;
  comprovanteUrl: string;
  origemNotaFiscal: boolean;
  notaFiscalId?: string; // referencia ao registro de NF quando origemNotaFiscal = true
  criadoEm: string; // ISO datetime
  atualizadoEm: string; // ISO datetime
}

export type NovaContaFinanceiraInput = Omit<
  ContaFinanceira,
  "id" | "status" | "dataBaixa" | "criadoEm" | "atualizadoEm"
>;

export interface FiltrosContaFinanceira {
  obraId?: string;
  status?: StatusConta;
  dataInicio?: string; // ISO date
  dataFim?: string; // ISO date
  categoria?: CategoriaGasto;
  busca?: string; // texto livre sobre favorecidoOuCliente/descricao
}

export interface BaixarContaInput {
  contaId: string;
  dataBaixa: string; // ISO date
}
