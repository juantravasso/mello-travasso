// Tipos dos pedidos de verificação (Fase 6.5b).

export type TipoVerificacao = "empresa_verificada" | "reivindicacao_perfil" | "relacao_comprovada";
export type StatusSolicitacao = "pendente" | "aprovada" | "recusada" | "cancelada" | "expirada" | "revogada";

export type CriarSolicitacaoInput =
  | { tipo: "empresa_verificada"; observacao?: string }
  | { tipo: "reivindicacao_perfil"; perfilSlug: string; observacao?: string }
  | { tipo: "relacao_comprovada"; avaliacaoId: string; observacao?: string };

/** Pedido como o solicitante o vê. */
export interface SolicitacaoItem {
  id: string;
  tipo: TipoVerificacao;
  status: StatusSolicitacao;
  criadoEm: string;
  decididaEm?: string;
  /** Motivo da decisão, escrito pela administração (obrigatório na recusa). */
  motivoDecisao?: string;
  observacao?: string;
  /** Documentos ainda guardados (somem quando o pedido é decidido). */
  documentos: number;
  perfilNome?: string;
  perfilSlug?: string;
  avaliacao?: { perfilNome: string; nota: number };
}

/** Quanto a tela de envio sabe sobre o pedido recém-criado. */
export interface NovaSolicitacao {
  id: string;
}

/** Contexto do alvo de uma reivindicação, para a tela de pedido. */
export interface PerfilReivindicavel {
  slug: string;
  nome: string;
  tipo: "pj" | "pf";
  cidade?: string;
  estado?: string;
  /** O perfil foi indicado com CNPJ e este é o CNPJ da empresa logada (ou não há CNPJ no perfil). */
  documentoConfere: boolean;
  /** A empresa logada já tem um rascunho de perfil que será substituído. */
  temRascunho: boolean;
}

export interface AvaliacaoComprovavel {
  id: string;
  perfilNome: string;
  nota: number;
}

export interface DadosReceitaAdmin {
  razaoSocial: string;
  situacao: string;
  ativa: boolean;
  socios: string[];
  municipio?: string;
  uf?: string;
  /** A razão social oficial é igual à declarada no cadastro (sem considerar acento e caixa). */
  razaoConfere: boolean;
}

export interface DocumentoAdmin {
  id: string;
  mime: string;
  tamanho: number;
  apagado: boolean;
}

/** Pedido como a administração o vê. */
export interface SolicitacaoAdminItem {
  id: string;
  tipo: TipoVerificacao;
  status: StatusSolicitacao;
  criadoEm: string;
  decididaEm?: string;
  motivoDecisao?: string;
  observacao?: string;
  solicitante: {
    nome: string;
    /** Nome declarado no cadastro (razão social ou nome civil do autônomo): é o que se confere contra o documento. */
    nomeDeclarado: string;
    tipo: "pj" | "pf";
    documento: string;
    email: string;
    verificada: boolean;
    criadaEm: string;
  };
  /** Dado oficial do CNPJ (Receita). undefined: não se aplica; null: consulta indisponível. */
  receita?: DadosReceitaAdmin | null;
  perfil?: {
    nome: string;
    slug: string;
    tipo: "pj" | "pf";
    documentoConfere: boolean | null;
    /** O que está em jogo: avaliações publicadas e recomendações que o perfil já tem. */
    avaliacoes: number;
    recomendacoes: number;
    /** Avaliações que a própria solicitante deixou neste perfil (saem do perfil se o pedido for aprovado). */
    avaliacoesDoSolicitante: number;
    outrosPedidosPendentes: number;
  };
  avaliacao?: { perfilNome: string; perfilSlug: string; nota: number; comentario?: string; relacaoContestada: boolean };
  documentos: DocumentoAdmin[];
}

export type DecisaoSolicitacao = "aprovar" | "recusar";
