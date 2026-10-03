export type TipoPerfil = "pj" | "pf";
export type StatusPerfil = "rascunho" | "publicado" | "suspenso";

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
}

export interface FiltrosBuscaPerfil {
  q?: string;
  profissao?: string;
  categoria?: string;
  estado?: string;
  cidade?: string;
  tipo?: TipoPerfil;
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
