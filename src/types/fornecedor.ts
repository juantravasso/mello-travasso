export interface Fornecedor {
  id: string;
  nome: string;
  /** CNPJ ou CPF, salvo só com dígitos — é a chave usada para não duplicar cadastro. */
  documento?: string;
  telefone?: string;
  email?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  observacao?: string;
  criadoEm: string;
  atualizadoEm: string;
}

export type NovoFornecedorInput = Omit<Fornecedor, "id" | "criadoEm" | "atualizadoEm">;

export interface FiltrosFornecedor {
  busca?: string;
}
