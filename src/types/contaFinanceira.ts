export type TipoConta = "pagar" | "receber";
export type StatusConta = "em_aberto" | "baixada";

export type CategoriaContaPagar =
  | "aluguel"
  | "aluguel_equipamentos"
  | "fretes"
  | "pro_labore_marcio"
  | "pro_labore_anderson"
  | "custo_funcionario"
  | "custo_produtos"
  | "manutencao_veiculos"
  | "custo_transporte"
  | "outros_custos_despesas";

export type CategoriaContaReceber = "obras" | "servicos_vans" | "manutencao";

export type CategoriaConta = CategoriaContaPagar | CategoriaContaReceber;

export type FormaPagamento =
  | "dinheiro"
  | "pix"
  | "cartao_credito"
  | "cartao_debito"
  | "transferencia"
  | "boleto"
  | "cheque";

export interface ContaFinanceira {
  id: string;
  tipo: TipoConta;
  obraId: string;
  valor: number;
  dataLancamento: string; // ISO date — quando o lançamento foi registrado
  dataVencimento: string; // ISO date — data prevista (pagamento ou recebimento)
  dataBaixa?: string; // ISO date — quando efetivamente paga/recebida
  status: StatusConta;
  favorecidoOuCliente: string;
  descricao: string;
  categoria?: CategoriaConta;
  formaPagamento?: FormaPagamento;
  observacao?: string;
  comprovanteUrl: string;
  origemNotaFiscal: boolean;
  notaFiscalId?: string; // referencia ao registro de NF quando origemNotaFiscal = true
  /**
   * true quando o lançamento foi criado rapidamente (ex.: foto de comprovante
   * no campo) e ainda precisa que alguém complete categoria, forma de
   * pagamento e observação depois. Lançamentos manuais já nascem completos.
   */
  precisaCompletarCadastro: boolean;
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
  categoria?: CategoriaConta;
  precisaCompletarCadastro?: boolean;
  busca?: string; // texto livre sobre favorecidoOuCliente/descricao
}

export interface BaixarContaInput {
  contaId: string;
  dataBaixa: string; // ISO date
}
