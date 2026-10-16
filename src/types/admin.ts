// Tipos da administração da plataforma (Fase 6.6): empresas, usuários e planos.

export type PlanoEmpresa = "teste" | "cortesia" | "ativo" | "suspenso" | "gratuito";

/** Planos que a administração pode atribuir. "suspenso" é legado: para barrar uma conta, bloqueie a empresa. */
export const PLANOS_ATRIBUIVEIS: readonly PlanoEmpresa[] = ["gratuito", "teste", "cortesia", "ativo"];

export interface EmpresaAdminItem {
  id: string;
  /** Nome para a administração: nunca o nome civil de autônomo nem razão social com CPF de MEI. */
  nome: string;
  tipo: "pj" | "pf";
  /** CNPJ completo; CPF mascarado. */
  documento: string;
  plano: PlanoEmpresa;
  testeTerminaEm?: string;
  bloqueadaEm?: string;
  criadoEm: string;
  usuarios: { id: string; email: string }[];
  perfilSlug?: string;
  perfilStatus?: "rascunho" | "publicado" | "indicado" | "suspenso";
  /** A empresa da própria sessão: não pode ser bloqueada por quem a usa. */
  propria: boolean;
  /** Tem um administrador da plataforma: não é bloqueada pela interface. */
  temAdmin: boolean;
}

export interface UsuarioAdminItem {
  id: string;
  nome: string;
  email: string;
  empresaId: string;
  empresaNome: string;
  papel: "dono" | "membro";
  admin: boolean;
  emailConfirmado: boolean;
  bloqueadoEm?: string;
  empresaBloqueada: boolean;
  criadoEm: string;
  /** O próprio admin logado. */
  proprio: boolean;
}

export interface RecursoAdmin {
  chave: string;
  nome: string;
  descricao?: string;
}

export interface PlanoAdmin {
  plano: PlanoEmpresa;
  recursos: string[];
  empresas: number;
}

export interface MatrizPlanos {
  recursos: RecursoAdmin[];
  planos: PlanoAdmin[];
}
