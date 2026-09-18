export type TipoConta = "pagar" | "receber";
export type StatusConta = "em_aberto" | "baixada" | "cancelada";

/**
 * Categorias e formas de pagamento padrão (ver src/lib/categorias.ts para os
 * rótulos). Usuários podem cadastrar novas opções pela UI — por isso o tipo
 * é `string`, não uma união literal fechada; os catálogos completos (padrão
 * + personalizados) vêm de CatalogoRepositorio.
 */
export type CategoriaContaPagar = string;
export type CategoriaContaReceber = string;
export type CategoriaConta = string;
export type FormaPagamento = string;

export type TipoEventoHistorico = "criacao" | "edicao" | "baixa" | "cancelamento";

export interface EventoHistorico {
  id: string;
  tipo: TipoEventoHistorico;
  usuario: string;
  data: string; // ISO datetime
  detalhes?: string;
}

export interface ParcelaInfo {
  numero: number;
  totalParcelas: number;
}

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
  /** Referência ao cadastro de fornecedores (ver src/types/fornecedor.ts) — só se aplica a contas do tipo "pagar". */
  fornecedorId?: string;
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
  /** Presente quando este lançamento é uma parcela de um pagamento parcelado. */
  parcelamentoId?: string;
  parcela?: ParcelaInfo;
  /** Motivo informado ao cancelar (quando status === "cancelada"). */
  motivoCancelamento?: string;
  historico: EventoHistorico[];
  criadoEm: string; // ISO datetime
  atualizadoEm: string; // ISO datetime
}

export type NovaContaFinanceiraInput = Omit<
  ContaFinanceira,
  "id" | "status" | "dataBaixa" | "historico" | "motivoCancelamento" | "criadoEm" | "atualizadoEm"
>;

export interface FiltrosContaFinanceira {
  obraId?: string;
  status?: StatusConta;
  dataInicio?: string; // ISO date
  dataFim?: string; // ISO date
  categoria?: CategoriaConta;
  fornecedorId?: string;
  precisaCompletarCadastro?: boolean;
  busca?: string; // texto livre sobre favorecidoOuCliente/descricao
}

export interface BaixarContaInput {
  contaId: string;
  dataBaixa: string; // ISO date
  usuario: string;
}

export interface CancelarContaInput {
  contaId: string;
  motivo?: string;
  usuario: string;
}
