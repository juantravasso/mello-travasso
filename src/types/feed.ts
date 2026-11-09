/** Tipos do feed da comunidade (Elo Profissionais). */

export interface AutorPostagem {
  perfilId: string;
  slug: string;
  nome: string;
  /** Primeira profissão e cidade/UF, para a linha de apresentação sob o nome. */
  resumo: string;
  logoUrl?: string;
  verificado: boolean;
}

export interface ComentarioItem {
  id: string;
  texto: string;
  criadoEm: string;
  autor: Pick<AutorPostagem, "slug" | "nome" | "logoUrl">;
  /** O comentário é da empresa logada (pode apagar). */
  meu: boolean;
}

export interface PostagemItem {
  id: string;
  texto: string;
  criadoEm: string;
  fotos: { id: string; url: string }[];
  autor: AutorPostagem;
  curtidas: number;
  comentarios: number;
  /** A empresa logada curtiu. */
  curtiu: boolean;
  /** A postagem é da empresa logada (pode apagar). */
  minha: boolean;
}

export interface PaginaFeed {
  itens: PostagemItem[];
  /** Cursor para a próxima página; null quando acabou. */
  proximo: string | null;
}

export interface SituacaoFeed {
  /** Há sessão. */
  logado: boolean;
  /** Pode publicar e interagir: tem perfil publicado, e-mail confirmado e o recurso "rede". */
  podeInteragir: boolean;
}
