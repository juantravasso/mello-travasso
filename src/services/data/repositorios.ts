import type { ModuloChave } from "@/lib/auth/modulos";
import type {
  EntradaCaptura,
  NovaTransferenciaInput,
  ResultadoCaptura,
  TransferenciaDeposito,
  VisaoDeposito,
  ColegaItem,
  CompromissoItem,
  EntradaCompromisso,
  ListaCompromissos,
  PreferenciasCalendario,
  AcessoTemporario,
  AcaoDecisaoDenuncia,
  AcaoModeracaoAvaliacao,
  AtualizarCategoriaInput,
  AtualizarProfissaoInput,
  AvaliacaoAdminItem,
  AvaliacaoFeita,
  AvaliacaoParaEditar,
  AvaliacaoRecebida,
  BaixarContaInput,
  CancelarContaInput,
  CategoriaItem,
  ContaFinanceira,
  DenunciarInput,
  DirecaoMovimento,
  FiltrosContaFinanceira,
  FiltrosFornecedor,
  FiltrosFuncionario,
  FiltrosItemProduto,
  Fornecedor,
  Funcionario,
  HistoricoPrecoProduto,
  IndicacaoItem,
  IndicarEmpresaInput,
  ItemProduto,
  MeuPerfil,
  MeuPortfolio,
  MinhaDenuncia,
  MovimentoEstoque,
  NovaCategoriaInput,
  NovaContaFinanceiraInput,
  NovaObraInput,
  NovaOpcaoPersonalizadaInput,
  NovaProfissaoInput,
  NovoFornecedorInput,
  NovoFuncionarioInput,
  NovoItemProdutoInput,
  NovoMovimentoInput,
  NotificacaoItem,
  NovoProdutoInput,
  Obra,
  OpcaoPersonalizada,
  PaginaDenunciasAdmin,
  PaginaLogsAdmin,
  PerfilAdminItem,
  Produto,
  ProdutoComSaldo,
  ProdutoDetalhado,
  AvaliacaoComprovavel,
  CriarSolicitacaoInput,
  DecisaoSolicitacao,
  EmpresaAdminItem,
  NovaSolicitacao,
  PerfilReivindicavel,
  SolicitacaoAdminItem,
  SolicitacaoItem,
  MatrizPlanos,
  ResultadoAction,
  UsuarioAdminItem,
  ResultadoCancelamentoConta,
  SalvarAvaliacaoInput,
  ServicoInput,
  TrabalhoInput,
  SalvarPerfilInput,
  TipoConta,
  ListaUsuariosEmpresa,
  ResumoConvite,
} from "@/types";

/**
 * Contratos da camada de dados. Implementados via Server Actions que falam
 * com o Postgres (Prisma) — ver ./server/*Actions.ts. Hooks e componentes só
 * conhecem estas interfaces, nunca o Prisma diretamente.
 */
export interface ObrasRepositorio {
  listar(): Promise<Obra[]>;
  obterPorId(id: string): Promise<Obra | null>;
  criar(input: NovaObraInput): Promise<Obra>;
  atualizar(id: string, input: Partial<NovaObraInput>): Promise<Obra>;
}

export interface ContasRepositorio {
  listar(filtros?: FiltrosContaFinanceira & { tipo?: TipoConta }): Promise<ContaFinanceira[]>;
  obterPorId(id: string): Promise<ContaFinanceira | null>;
  criar(input: NovaContaFinanceiraInput): Promise<ContaFinanceira>;
  atualizar(id: string, input: Partial<NovaContaFinanceiraInput>): Promise<ContaFinanceira>;
  baixar(input: BaixarContaInput): Promise<ContaFinanceira>;
  cancelar(input: CancelarContaInput): Promise<ResultadoCancelamentoConta>;
}

export interface ItensProdutoRepositorio {
  listar(filtros?: FiltrosItemProduto): Promise<ItemProduto[]>;
  criarEmLote(itens: NovoItemProdutoInput[]): Promise<ItemProduto[]>;
  historicoPorDescricao(descricaoNormalizada: string): Promise<HistoricoPrecoProduto | null>;
  listarDescricoesUnicas(): Promise<string[]>;
}

export interface CapturaRepositorio {
  registrar(entrada: EntradaCaptura): Promise<ResultadoAction<ResultadoCaptura>>;
}

export interface DepositoRepositorio {
  obter(): Promise<ResultadoAction<VisaoDeposito>>;
  transferir(input: NovaTransferenciaInput): Promise<ResultadoAction<TransferenciaDeposito>>;
  listarTransferencias(filtro?: { obraId?: string; produtoId?: string }): Promise<ResultadoAction<TransferenciaDeposito[]>>;
  obterCustosTransferidos(): Promise<ResultadoAction<Record<string, number>>>;
}

export interface FuncionariosRepositorio {
  listar(filtros?: FiltrosFuncionario): Promise<Funcionario[]>;
  obterPorId(id: string): Promise<Funcionario | null>;
  criar(input: NovoFuncionarioInput): Promise<Funcionario>;
  atualizar(id: string, input: Partial<NovoFuncionarioInput>): Promise<Funcionario>;
  definirStatus(id: string, status: Funcionario["status"]): Promise<Funcionario>;
}

export interface CatalogoRepositorio {
  listarCategorias(tipo: TipoConta): Promise<OpcaoPersonalizada[]>;
  criarCategoria(tipo: TipoConta, input: NovaOpcaoPersonalizadaInput): Promise<OpcaoPersonalizada>;
  listarFormasPagamento(): Promise<OpcaoPersonalizada[]>;
  criarFormaPagamento(input: NovaOpcaoPersonalizadaInput): Promise<OpcaoPersonalizada>;
}

export interface FornecedoresRepositorio {
  listar(filtros?: FiltrosFornecedor): Promise<Fornecedor[]>;
  obterPorId(id: string): Promise<Fornecedor | null>;
  criar(input: NovoFornecedorInput): Promise<Fornecedor>;
  atualizar(id: string, input: Partial<NovoFornecedorInput>): Promise<Fornecedor>;
  resolver(nome: string, documento?: string): Promise<Fornecedor>;
}

export interface EstoqueRepositorio {
  listarProdutos(): Promise<ProdutoComSaldo[]>;
  obterProdutoPorId(id: string): Promise<ProdutoDetalhado | null>;
  listarMovimentos(produtoId: string): Promise<MovimentoEstoque[]>;
  criarProduto(input: NovoProdutoInput): Promise<Produto>;
  registrarMovimento(input: NovoMovimentoInput): Promise<MovimentoEstoque>;
}

export interface RedeRepositorio {
  listarTaxonomia(): Promise<CategoriaItem[]>;
  obterMeuPerfil(): Promise<ResultadoAction<MeuPerfil>>;
  salvarMeuPerfil(input: SalvarPerfilInput): Promise<ResultadoAction<MeuPerfil>>;
  definirPublicacao(publicar: boolean): Promise<ResultadoAction<MeuPerfil>>;
  obterAvaliacaoParaEditar(slug: string): Promise<ResultadoAction<AvaliacaoParaEditar>>;
  salvarAvaliacao(input: SalvarAvaliacaoInput): Promise<ResultadoAction<null>>;
  listarAvaliacoesFeitas(): Promise<AvaliacaoFeita[]>;
  listarAvaliacoesRecebidas(): Promise<AvaliacaoRecebida[]>;
  responderRelacao(avaliacaoId: string, estado: "confirmada" | "contestada"): Promise<ResultadoAction<null>>;
  reenviarConfirmacaoEmail(): Promise<ResultadoAction<null>>;
  confirmarEmail(token: string): Promise<ResultadoAction<null>>;
  responderAvaliacao(avaliacaoId: string, texto: string): Promise<ResultadoAction<null>>;
  recomendarPerfil(slug: string): Promise<ResultadoAction<null>>;
  removerRecomendacao(slug: string): Promise<ResultadoAction<null>>;
  indicarEmpresa(input: IndicarEmpresaInput): Promise<ResultadoAction<{ slug: string; jaExistia: boolean }>>;
  listarMinhasIndicacoes(): Promise<IndicacaoItem[]>;
  listarNotificacoes(): Promise<NotificacaoItem[]>;
  contarNotificacoesNaoLidas(): Promise<number>;
  marcarNotificacaoLida(id: string): Promise<void>;
  marcarTodasNotificacoesLidas(): Promise<void>;
  denunciar(input: DenunciarInput): Promise<ResultadoAction<null>>;
  listarMinhasDenuncias(): Promise<MinhaDenuncia[]>;
  complementarDenuncia(denunciaId: string, texto: string): Promise<ResultadoAction<null>>;
}

export interface TaxonomiaAdminRepositorio {
  listar(): Promise<CategoriaItem[]>;
  criarCategoria(input: NovaCategoriaInput): Promise<ResultadoAction<null>>;
  atualizarCategoria(id: string, input: AtualizarCategoriaInput): Promise<ResultadoAction<null>>;
  excluirCategoria(id: string): Promise<ResultadoAction<null>>;
  criarProfissao(input: NovaProfissaoInput): Promise<ResultadoAction<null>>;
  atualizarProfissao(id: string, input: AtualizarProfissaoInput): Promise<ResultadoAction<null>>;
  excluirProfissao(id: string): Promise<ResultadoAction<null>>;
}

export interface PortfolioRepositorio {
  obter(): Promise<ResultadoAction<MeuPortfolio>>;
  salvarServicos(lista: ServicoInput[]): Promise<ResultadoAction<null>>;
  criarTrabalho(input: TrabalhoInput): Promise<ResultadoAction<{ id: string }>>;
  atualizarTrabalho(id: string, input: TrabalhoInput): Promise<ResultadoAction<null>>;
  excluirTrabalho(id: string): Promise<ResultadoAction<null>>;
  moverTrabalho(id: string, direcao: DirecaoMovimento): Promise<ResultadoAction<null>>;
  moverFoto(fotoId: string, direcao: DirecaoMovimento): Promise<ResultadoAction<null>>;
  excluirFoto(fotoId: string): Promise<ResultadoAction<null>>;
  removerLogo(): Promise<ResultadoAction<null>>;
}

export interface AvaliacoesAdminRepositorio {
  listar(busca?: string, status?: string): Promise<AvaliacaoAdminItem[]>;
  moderar(avaliacaoId: string, acao: AcaoModeracaoAvaliacao, motivo: string, senha?: string): Promise<ResultadoAction<null>>;
}

export interface DenunciasAdminRepositorio {
  listar(filtro?: string, pagina?: number): Promise<PaginaDenunciasAdmin>;
  assumir(denunciaId: string): Promise<ResultadoAction<null>>;
  solicitarInformacoes(denunciaId: string, mensagem: string): Promise<ResultadoAction<null>>;
  decidir(
    denunciaId: string,
    acao: AcaoDecisaoDenuncia,
    mensagem: string,
    observacao?: string,
    senha?: string,
    versaoVista?: number,
  ): Promise<ResultadoAction<null>>;
}

export interface LogsAdminRepositorio {
  listar(pagina?: number): Promise<PaginaLogsAdmin>;
}

export interface PerfisAdminRepositorio {
  listar(busca?: string): Promise<PerfilAdminItem[]>;
  suspender(slug: string, motivo: string, senha?: string): Promise<ResultadoAction<null>>;
  reativar(slug: string, senha?: string): Promise<ResultadoAction<null>>;
}

export interface EmpresasAdminRepositorio {
  listar(busca?: string): Promise<EmpresaAdminItem[]>;
  bloquear(empresaId: string, motivo: string, senha?: string): Promise<ResultadoAction<null>>;
  desbloquear(empresaId: string, senha?: string): Promise<ResultadoAction<null>>;
  alterarPlano(empresaId: string, plano: string, motivo: string, senha?: string): Promise<ResultadoAction<null>>;
}

export interface UsuariosAdminRepositorio {
  listar(busca?: string): Promise<UsuarioAdminItem[]>;
  bloquear(usuarioId: string, motivo: string, senha?: string): Promise<ResultadoAction<null>>;
  desbloquear(usuarioId: string, senha?: string): Promise<ResultadoAction<null>>;
  encerrarSessoes(usuarioId: string, senha?: string): Promise<ResultadoAction<null>>;
}

/** Usuários da própria empresa (só o dono). A senha do dono confirma criar e redefinir. */
export interface UsuariosEmpresaRepositorio {
  listar(): Promise<ResultadoAction<ListaUsuariosEmpresa>>;
  criar(dados: { nome: string; email: string; modulos: ModuloChave[] }, senhaDoDono: string): Promise<ResultadoAction<AcessoTemporario>>;
  alterarModulos(usuarioId: string, modulos: ModuloChave[], senhaDoDono: string): Promise<ResultadoAction<ModuloChave[]>>;
  redefinirAcesso(usuarioId: string, senhaDoDono: string): Promise<ResultadoAction<AcessoTemporario>>;
  desativar(usuarioId: string): Promise<ResultadoAction<null>>;
  reativar(usuarioId: string): Promise<ResultadoAction<null>>;
}

/** Link de convite da própria empresa (só o dono): o código e quantos cadastros vieram dele. */
export interface ConviteRepositorio {
  obter(): Promise<ResultadoAction<ResumoConvite>>;
}

/** Calendário do usuário: compromissos próprios e os compartilhados com ele. */
export interface CalendarioRepositorio {
  listar(de: string, ate: string): Promise<ResultadoAction<ListaCompromissos>>;
  proximos(limite?: number): Promise<ResultadoAction<CompromissoItem[]>>;
  obter(id: string): Promise<ResultadoAction<CompromissoItem>>;
  colegas(): Promise<ResultadoAction<ColegaItem[]>>;
  criar(entrada: EntradaCompromisso): Promise<ResultadoAction<CompromissoItem>>;
  atualizar(id: string, entrada: EntradaCompromisso): Promise<ResultadoAction<CompromissoItem>>;
  excluir(id: string): Promise<ResultadoAction<null>>;
  obterPreferencias(): Promise<ResultadoAction<PreferenciasCalendario>>;
  salvarPreferencias(prefs: { lembretesPorEmail: boolean; lembretesNoApp: boolean }): Promise<ResultadoAction<null>>;
  salvarFuso(fuso: string): Promise<ResultadoAction<null>>;
}

export interface PlanosAdminRepositorio {
  obter(): Promise<MatrizPlanos>;
  salvarRecursos(plano: string, recursos: string[], motivo: string, senha?: string): Promise<ResultadoAction<null>>;
}

export interface VerificacaoRepositorio {
  criar(input: CriarSolicitacaoInput): Promise<ResultadoAction<NovaSolicitacao>>;
  listarMinhas(): Promise<SolicitacaoItem[]>;
  cancelar(solicitacaoId: string): Promise<ResultadoAction<null>>;
  obterPerfilReivindicavel(slug: string): Promise<ResultadoAction<PerfilReivindicavel>>;
  obterAvaliacaoComprovavel(avaliacaoId: string): Promise<ResultadoAction<AvaliacaoComprovavel>>;
}

export interface VerificacoesAdminRepositorio {
  listar(filtro?: "pendentes" | "decididas"): Promise<SolicitacaoAdminItem[]>;
  contarPendentes(): Promise<number>;
  decidir(solicitacaoId: string, decisao: DecisaoSolicitacao, motivo: string | undefined, senha?: string): Promise<ResultadoAction<null>>;
  desfazer(solicitacaoId: string, motivo: string, senha?: string): Promise<ResultadoAction<null>>;
}
