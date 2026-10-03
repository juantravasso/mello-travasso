export type TipoPerfil = "pj" | "pf";
export type StatusPerfil = "rascunho" | "publicado" | "indicado" | "suspenso";

export interface ProfissaoItem {
  id: string;
  nome: string;
  slug: string;
  categoriaId: string;
  ativo: boolean;
}

export interface CategoriaItem {
  id: string;
  nome: string;
  slug: string;
  paiId?: string;
  ordem: number;
  ativo: boolean;
  profissoes: ProfissaoItem[];
}

export interface NovaCategoriaInput {
  nome: string;
  paiId?: string;
}

export interface AtualizarCategoriaInput {
  nome?: string;
  paiId?: string | null;
  ordem?: number;
  ativo?: boolean;
}

export interface NovaProfissaoInput {
  nome: string;
  categoriaId: string;
}

export interface AtualizarProfissaoInput {
  nome?: string;
  categoriaId?: string;
  ativo?: boolean;
}

/** O que a listagem pública mostra de cada perfil — sem id interno, sem contato privado. */
export interface PerfilPublicoResumo {
  slug: string;
  tipo: TipoPerfil;
  nome: string;
  nomeFantasia?: string;
  descricao?: string;
  cidade?: string;
  estado?: string;
  profissoes: string[];
  /** true quando é um perfil básico criado por indicação (sem cadastro). */
  indicado: boolean;
  /** Média e total de avaliações publicadas; ausente quando não há nenhuma. */
  avaliacao?: { media: number; total: number };
}

/** Perfil completo para a página pública. Telefone/WhatsApp só vêm se o dono marcou como públicos. */
export interface PerfilPublicoCompleto extends PerfilPublicoResumo {
  regiao?: string;
  areasAtendimento: string[];
  telefone?: string;
  whatsapp?: string;
  instagram?: string;
  site?: string;
  profissoesDetalhe: { nome: string; slug: string }[];
  criadoEm: string;
  resumo: ResumoAvaliacoes;
}

export interface FiltrosBuscaPerfil {
  q?: string;
  profissao?: string;
  categoria?: string;
  estado?: string;
  cidade?: string;
  tipo?: TipoPerfil;
  /** Só perfis com média de avaliações igual ou acima. */
  notaMin?: number;
  pagina?: number;
}

export interface ResultadoBuscaPerfil {
  itens: PerfilPublicoResumo[];
  total: number;
  pagina: number;
  totalPaginas: number;
  limiteExcedido?: boolean;
}

/** Perfil como o dono vê e edita (inclui rascunho, flags de visibilidade e status). */
export interface MeuPerfil {
  slug: string;
  tipo: TipoPerfil;
  status: StatusPerfil;
  nome: string;
  nomeFantasia?: string;
  razaoSocial?: string;
  descricao?: string;
  estado?: string;
  cidade?: string;
  regiao?: string;
  areasAtendimento: string[];
  telefone?: string;
  telefonePublico: boolean;
  whatsapp?: string;
  whatsappPublico: boolean;
  instagram?: string;
  site?: string;
  profissaoIds: string[];
}

export interface SalvarPerfilInput {
  nome: string;
  nomeFantasia?: string;
  descricao?: string;
  estado?: string;
  cidade?: string;
  regiao?: string;
  areasAtendimento: string[];
  telefone?: string;
  telefonePublico: boolean;
  whatsapp?: string;
  whatsappPublico: boolean;
  instagram?: string;
  site?: string;
  profissaoIds: string[];
}

export interface PerfilAdminItem {
  slug: string;
  tipo: TipoPerfil;
  status: StatusPerfil;
  nome: string;
  cidade?: string;
  estado?: string;
  atualizadoEm: string;
}

export interface ResumoAvaliacoes {
  /** null quando ainda não há avaliações publicadas. */
  media: number | null;
  total: number;
  /** Quantidade por nota, de 1 a 5. */
  distribuicao: Record<1 | 2 | 3 | 4 | 5, number>;
  recomendacoes: number;
}

export interface RespostaPublica {
  texto: string;
  autorNome: string;
  criadoEm: string;
  editadaEm?: string;
}

/** Avaliação como aparece na página pública. O avaliador é só o nome público, sem ids. */
export interface AvaliacaoPublica {
  id: string;
  nota: number;
  comentario?: string;
  pros: string[];
  contras: string[];
  criadoEm: string;
  editadaEm?: string;
  /** Estado da verificação da relação comercial (Fase 6.5 a preenche). */
  verificacao: "nao_verificada" | "relacao_confirmada" | "relacao_comprovada";
  avaliadorNome: string;
  avaliadorSlug?: string;
  resposta?: RespostaPublica;
}

export interface PaginaAvaliacoes {
  itens: AvaliacaoPublica[];
  pagina: number;
  totalPaginas: number;
}

export interface EstadoInteracao {
  logado: boolean;
  /** O perfil pertence à empresa logada: não pode avaliar nem recomendar. */
  proprio: boolean;
  /** Criou este perfil por indicação: pode recomendar, mas não avaliar. */
  criador: boolean;
  jaAvaliou: boolean;
  jaRecomendou: boolean;
}

export interface MinhaAvaliacao {
  nota: number;
  comentario?: string;
  pros: string[];
  contras: string[];
}

export interface SalvarAvaliacaoInput extends MinhaAvaliacao {
  perfilSlug: string;
}

export interface AvaliacaoParaEditar {
  perfil: { slug: string; nome: string };
  avaliacao: MinhaAvaliacao | null;
}

export interface AvaliacaoFeita extends MinhaAvaliacao {
  id: string;
  /** "publicada" ou escondida pela moderação. */
  status: "publicada" | "oculta" | "removida";
  perfilSlug: string;
  perfilNome: string;
  criadoEm: string;
  editadaEm?: string;
  resposta?: RespostaPublica;
}

export interface AvaliacaoRecebida {
  id: string;
  nota: number;
  comentario?: string;
  pros: string[];
  contras: string[];
  criadoEm: string;
  editadaEm?: string;
  avaliadorNome: string;
  resposta?: { texto: string; criadoEm: string };
}

export interface IndicacaoItem {
  perfilSlug: string;
  perfilNome: string;
  perfilIndicado: boolean;
  cidade?: string;
  estado?: string;
  criadoEm: string;
}

export interface IndicarEmpresaInput {
  nome: string;
  tipo: TipoPerfil;
  profissaoId: string;
  estado: string;
  cidade: string;
  documento?: string;
}

export interface NotificacaoItem {
  id: string;
  tipo: string;
  texto: string;
  href: string;
  lida: boolean;
  criadoEm: string;
}

export type StatusAvaliacao = "publicada" | "oculta" | "removida";

export interface AvaliacaoAdminItem {
  id: string;
  status: StatusAvaliacao;
  nota: number;
  comentario?: string;
  criadoEm: string;
  perfilSlug: string;
  perfilNome: string;
  avaliadorNome: string;
}

export type AcaoModeracaoAvaliacao = "ocultar" | "remover" | "restaurar";
