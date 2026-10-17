export type StatusObra = "em_andamento" | "concluida" | "pausada";

export interface Obra {
  id: string;
  nome: string;
  cliente: string;
  endereco?: string;
  status: StatusObra;
  dataInicio: string; // ISO date (yyyy-mm-dd)
  dataFim?: string; // ISO date, preenchido quando concluida
  orcamentoPrevisto?: number;
  observacoes?: string;
  /** Local especial de estoque da empresa (um por empresa): não é projeto, não tem orçamento nem aparece nas listas de projetos. */
  ehDeposito?: boolean;
  criadoEm: string; // ISO datetime
  atualizadoEm: string; // ISO datetime
}

export type NovaObraInput = Omit<Obra, "id" | "criadoEm" | "atualizadoEm" | "ehDeposito">;

export interface ResumoFinanceiroObra {
  obraId: string;
  totalPago: number;
  totalAReceber: number;
  totalRecebido: number;
  totalEmAberto: number;
  /** Material tirado do Depósito para este projeto, ao valor da última compra (já entra no custo, mesmo sem conta). */
  totalMateriaisDoDeposito: number;
  orcamentoPrevisto?: number;
  saldoOrcamento?: number; // orcamentoPrevisto - (totalPago + totalMateriaisDoDeposito), quando houver orcamento
}
