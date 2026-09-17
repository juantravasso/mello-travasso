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
  criadoEm: string; // ISO datetime
  atualizadoEm: string; // ISO datetime
}

export type NovaObraInput = Omit<Obra, "id" | "criadoEm" | "atualizadoEm">;

export interface ResumoFinanceiroObra {
  obraId: string;
  totalPago: number;
  totalAReceber: number;
  totalRecebido: number;
  totalEmAberto: number;
  orcamentoPrevisto?: number;
  saldoOrcamento?: number; // orcamentoPrevisto - totalPago, quando houver orcamento
}
