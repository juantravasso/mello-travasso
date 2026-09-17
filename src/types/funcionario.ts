export type StatusFuncionario = "ativo" | "inativo";

export interface Funcionario {
  id: string;
  nome: string;
  cargo: string;
  telefone?: string;
  email?: string;
  cpf?: string;
  dataAdmissao: string; // ISO date
  obraId?: string; // obra em que está alocado atualmente
  salario?: number;
  status: StatusFuncionario;
  criadoEm: string;
  atualizadoEm: string;
}

export type NovoFuncionarioInput = Omit<Funcionario, "id" | "status" | "criadoEm" | "atualizadoEm">;

export interface FiltrosFuncionario {
  obraId?: string;
  status?: StatusFuncionario;
  busca?: string;
}
