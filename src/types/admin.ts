// Tipos da administração da plataforma (Fase 6.6): empresas, usuários e planos.

export type PlanoEmpresa = "teste" | "cortesia" | "ativo" | "suspenso" | "gratuito";

/** Planos que a administração pode atribuir. "suspenso" é somente leitura (assinatura inativa); para barrar a conta inteira, bloqueie a empresa. */
export const PLANOS_ATRIBUIVEIS: readonly PlanoEmpresa[] = ["gratuito", "teste", "cortesia", "ativo"];

export interface EmpresaAdminItem {
  id: string;
  /** Nome para a administração: nunca o nome civil de autônomo nem razão social com CPF de MEI. */
  nome: string;
  tipo: "pj" | "pf";
  /** CNPJ completo; CPF mascarado. */
  documento: string;
  plano: PlanoEmpresa;
  /** Chave do plano comercial contratado (conta vagas, não muda o acesso). */
  planoComercial?: string;
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

/** Números da página inicial da administração, todos lidos do banco. */
export interface ResumoAdmin {
  empresas: { total: number; emTeste: number; ativas: number; gratuitas: number; bloqueadas: number };
  usuarios: number;
  perfisPublicados: number;
  avaliacoes: number;
  recomendacoes: number;
  trabalhos: number;
  denunciasAbertas: number;
  assinaturas: {
    ativas: number;
    /** Estimativa a partir das assinaturas cobradas pelo Mercado Pago (anual dividido por 12). Plano ativado à mão não entra. */
    receitaMensalCentavos: number;
  };
}

export interface RecomendacaoAdminItem {
  id: string;
  criadoEm: string;
  perfilSlug: string;
  perfilNome: string;
  /** Nome público de quem recomendou (nunca o nome civil de autônomo). */
  recomendadoPorNome: string;
}

export interface TrabalhoAdminItem {
  id: string;
  titulo: string;
  descricao?: string;
  criadoEm: string;
  fotos: number;
  perfilSlug: string;
  perfilNome: string;
}
