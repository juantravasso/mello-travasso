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
  /** URL da logo (só perfil publicado). */
  logoUrl?: string;
  /** A administração conferiu os documentos desta empresa (ou profissional). */
  verificado: boolean;
  /** Média e total de avaliações publicadas; ausente quando não há nenhuma. */
  avaliacao?: { media: number; total: number };
  /** Só na busca por raio: km entre o centro da cidade pesquisada e o da cidade do perfil. */
  distanciaKm?: number;
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
  /** Páginas locais (profissão + cidade) que listam este perfil; só de perfil publicado. */
  locais?: { rotulo: string; href: string }[];
  resumo: ResumoAvaliacoes;
  servicos: ServicoPublico[];
  galerias: GaleriaPublica[];
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
  /** Busca por raio em volta da cidade (exige estado e cidade conhecidos). Ver RAIOS_KM. */
  raioKm?: number;
  pagina?: number;
}

export interface ResultadoBuscaPerfil {
  itens: PerfilPublicoResumo[];
  total: number;
  pagina: number;
  totalPaginas: number;
  limiteExcedido?: boolean;
  /** Raio aplicado, com o nome oficial da cidade usada como centro. */
  raio?: { cidade: string; estado: string; km: number };
  /** Pediram raio, mas a cidade não foi encontrada na base de municípios: buscou só pelo nome. */
  raioIgnorado?: boolean;
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
  /** Avaliações publicadas com a relação comercial confirmada pelo avaliado ou comprovada por documento. */
  verificadas: number;
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
  /** Quem atestou a relação comercial: ninguém, o avaliado (6.5a) ou um documento analisado pela administração (6.5b). */
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
  verificacao: "nao_verificada" | "relacao_confirmada" | "relacao_comprovada";
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
  /** O que o avaliado respondeu sobre ter trabalhado com o avaliador. */
  relacao?: "confirmada" | "contestada";
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
  /** Só nos lembretes do calendário. */
  titulo?: string;
  texto: string;
  href: string;
  lida: boolean;
  criadoEm: string;
  /** Compromisso de origem (lembretes do calendário), se ainda existir. */
  compromissoId?: string;
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
  /** O avaliado respondeu que não reconhece ter trabalhado com o avaliador. */
  relacaoContestada: boolean;
}

export type AcaoModeracaoAvaliacao = "ocultar" | "remover" | "restaurar";

export type TipoDenuncia =
  | "fraude"
  | "avaliacao_falsa"
  | "nunca_trabalhou"
  | "conteudo_ofensivo"
  | "spam"
  | "informacao_falsa"
  | "conflito_interesse"
  | "outro";

export type StatusDenuncia = "aberta" | "em_analise" | "aguardando_informacoes" | "resolvida" | "rejeitada";

export type DecisaoDenuncia = "mantida" | "avaliacao_ocultada" | "avaliacao_removida" | "perfil_suspenso";

export type AcaoDecisaoDenuncia = "manter" | "ocultar_avaliacao" | "remover_avaliacao" | "suspender_perfil";

/** Alvo da denúncia: uma avaliação (por id) ou um perfil (por slug). */
export type AlvoDenuncia = { tipo: "avaliacao"; avaliacaoId: string } | { tipo: "perfil"; perfilSlug: string };

export interface DenunciarInput {
  alvo: AlvoDenuncia;
  motivo: TipoDenuncia;
  descricao: string;
}

export interface MinhaDenuncia {
  id: string;
  alvoRotulo: string;
  alvoTipo: "avaliacao" | "perfil";
  motivo: TipoDenuncia;
  status: StatusDenuncia;
  criadoEm: string;
  /** Mensagem da administração (pedido de informação ou resultado). */
  mensagem?: string;
  complemento?: string;
}

export interface DenunciaAdminItem {
  id: string;
  alvoTipo: "avaliacao" | "perfil";
  motivo: TipoDenuncia;
  status: StatusDenuncia;
  descricao: string;
  complemento?: string;
  criadoEm: string;
  denuncianteNome: string;
  adminResponsavelNome?: string;
  decisao?: DecisaoDenuncia;
  observacaoAdmin?: string;
  mensagemAoDenunciante?: string;
  avaliacao?: {
    id: string;
    nota: number;
    comentario?: string;
    status: StatusAvaliacao;
    versao: number;
    perfilNome: string;
    perfilSlug: string;
    avaliadorNome: string;
  };
  perfil?: { slug: string; nome: string; status: StatusPerfil };
}

export interface PaginaDenunciasAdmin {
  itens: DenunciaAdminItem[];
  pagina: number;
  totalPaginas: number;
  /** Denúncias ainda não encerradas (todas as páginas). */
  abertas: number;
}

export interface LogAdminItem {
  id: string;
  acao: string;
  alvoTipo: string;
  alvoId?: string;
  detalhes: string;
  criadoEm: string;
  adminNome: string;
}

export interface PaginaLogsAdmin {
  itens: LogAdminItem[];
  pagina: number;
  totalPaginas: number;
}

export interface ServicoItem {
  id: string;
  nome: string;
  descricao?: string;
}

export interface FotoTrabalho {
  id: string;
  arquivoId: string;
}

export interface TrabalhoItem {
  id: string;
  titulo: string;
  descricao?: string;
  servicoId?: string;
  galeria?: string;
  dataTrabalho?: string;
  fotos: FotoTrabalho[];
}

export interface MeuPortfolio {
  logoArquivoId?: string;
  servicos: ServicoItem[];
  trabalhos: TrabalhoItem[];
  totalArquivos: number;
  limites: { servicos: number; trabalhos: number; fotosPorTrabalho: number; arquivos: number };
}

export interface ServicoInput {
  id?: string;
  nome: string;
  descricao?: string;
}

export interface TrabalhoInput {
  titulo: string;
  descricao?: string;
  servicoId?: string;
  galeria?: string;
  dataTrabalho?: string;
}

export interface ServicoPublico {
  nome: string;
  descricao?: string;
}

export interface TrabalhoPublico {
  id: string;
  titulo: string;
  descricao?: string;
  servico?: string;
  dataTrabalho?: string;
  /** Ids dos arquivos (URL pública: /api/arquivos/<id>). */
  fotos: string[];
}

export interface GaleriaPublica {
  nome?: string;
  trabalhos: TrabalhoPublico[];
}

export type DirecaoMovimento = "subir" | "descer";
