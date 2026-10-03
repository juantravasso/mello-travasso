import type {
  BaixarContaInput,
  CancelarContaInput,
  ContaFinanceira,
  FiltrosContaFinanceira,
  FiltrosFornecedor,
  FiltrosFuncionario,
  FiltrosItemProduto,
  Fornecedor,
  Funcionario,
  HistoricoPrecoProduto,
  ItemProduto,
  MovimentoEstoque,
  NovaContaFinanceiraInput,
  NovaObraInput,
  NovaOpcaoPersonalizadaInput,
  NovoFornecedorInput,
  NovoFuncionarioInput,
  NovoItemProdutoInput,
  NovoMovimentoInput,
  NovoProdutoInput,
  Obra,
  OpcaoPersonalizada,
  Produto,
  ProdutoComSaldo,
  ProdutoDetalhado,
  ResultadoCancelamentoConta,
  TipoConta,
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
