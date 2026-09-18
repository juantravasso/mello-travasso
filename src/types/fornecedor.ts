export interface Fornecedor {
  id: string;
  nome: string;
  documento?: string; // CNPJ ou CPF
  telefone?: string;
  email?: string;
  observacao?: string;
  criadoEm: string;
  atualizadoEm: string;
}

export type NovoFornecedorInput = Omit<Fornecedor, "id" | "criadoEm" | "atualizadoEm">;

export interface FiltrosFornecedor {
  busca?: string;
}
