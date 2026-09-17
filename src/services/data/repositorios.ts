import type {
  BaixarContaInput,
  ContaFinanceira,
  FiltrosContaFinanceira,
  FiltrosFuncionario,
  FiltrosItemProduto,
  Funcionario,
  HistoricoPrecoProduto,
  ItemProduto,
  NovaContaFinanceiraInput,
  NovaObraInput,
  NovoFuncionarioInput,
  NovoItemProdutoInput,
  Obra,
  TipoConta,
} from "@/types";

/**
 * Contratos da camada de dados. Hoje implementados sobre localStorage
 * (ver localStorage/*Repositorio.ts); quando o backend existir, basta criar
 * uma implementação HTTP destas mesmas interfaces e trocar o import em
 * services/data/index.ts — hooks e componentes não mudam.
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
  baixar(input: BaixarContaInput): Promise<ContaFinanceira>;
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
