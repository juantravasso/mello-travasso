// Contrato de retorno das Server Actions de auth — ver
// docs/prd/multiempresa-login-trial.md §6 "Contratos (TS)".

export type CodigoErro =
  | "NAO_AUTENTICADO"
  | "SOMENTE_LEITURA"
  | "LIMITE"
  | "VALIDACAO"
  | "NAO_ENCONTRADO"
  | "GENERICO";

export type ResultadoAction<T> =
  | { ok: true; dados: T }
  | { ok: false; erro: CodigoErro; mensagem: string; campos?: Record<string, string> };

export interface EmpresaAtual {
  id: string;
  documento: string; // não editável — RF-20
  tipoPessoa: "pj" | "pf";
  razaoSocial: string;
  nomeFantasia?: string;
  telefone?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
}

export type NovaEmpresaAtualInput = Omit<EmpresaAtual, "id" | "documento" | "tipoPessoa">;
