import type {
  CatalogoRepositorio,
  ContasRepositorio,
  EstoqueRepositorio,
  FornecedoresRepositorio,
  FuncionariosRepositorio,
  ItensProdutoRepositorio,
  ObrasRepositorio,
} from "./repositorios";
import {
  atualizarObra,
  criarObra,
  listarObras,
  obterObraPorId,
} from "./server/obrasActions";
import {
  atualizarConta,
  baixarConta,
  cancelarConta,
  criarConta,
  listarContas,
  obterContaPorId,
} from "./server/contasActions";
import {
  criarItensProdutoEmLote,
  historicoPrecoPorDescricao,
  listarDescricoesUnicasProduto,
  listarItensProduto,
} from "./server/itensProdutoActions";
import {
  atualizarFuncionario,
  criarFuncionario,
  definirStatusFuncionario,
  listarFuncionarios,
  obterFuncionarioPorId,
} from "./server/funcionariosActions";
import {
  criarCategoriaPersonalizada,
  criarFormaPagamentoPersonalizada,
  listarCategoriasPersonalizadas,
  listarFormasPagamentoPersonalizadas,
} from "./server/catalogoActions";
import {
  atualizarFornecedor,
  criarFornecedor,
  listarFornecedores,
  obterFornecedorPorId,
  resolverFornecedor,
} from "./server/fornecedoresActions";
import {
  criarProduto,
  listarMovimentos,
  listarProdutos,
  obterProdutoPorId,
  registrarMovimento,
} from "./server/estoqueActions";

/**
 * Ponto único de acesso à camada de dados. Cada método aqui é uma Server
 * Action (ver ./server/*) que roda no servidor e fala com o Postgres via
 * Prisma — hooks e componentes continuam chamando essas interfaces sem
 * saber que existe um banco por trás.
 */
export const obrasRepositorio: ObrasRepositorio = {
  listar: listarObras,
  obterPorId: obterObraPorId,
  criar: criarObra,
  atualizar: atualizarObra,
};

export const contasRepositorio: ContasRepositorio = {
  listar: listarContas,
  obterPorId: obterContaPorId,
  criar: criarConta,
  atualizar: atualizarConta,
  baixar: baixarConta,
  cancelar: cancelarConta,
};

export const itensProdutoRepositorio: ItensProdutoRepositorio = {
  listar: listarItensProduto,
  criarEmLote: criarItensProdutoEmLote,
  historicoPorDescricao: historicoPrecoPorDescricao,
  listarDescricoesUnicas: listarDescricoesUnicasProduto,
};

export const funcionariosRepositorio: FuncionariosRepositorio = {
  listar: listarFuncionarios,
  obterPorId: obterFuncionarioPorId,
  criar: criarFuncionario,
  atualizar: atualizarFuncionario,
  definirStatus: definirStatusFuncionario,
};

export const catalogoRepositorio: CatalogoRepositorio = {
  listarCategorias: listarCategoriasPersonalizadas,
  criarCategoria: criarCategoriaPersonalizada,
  listarFormasPagamento: listarFormasPagamentoPersonalizadas,
  criarFormaPagamento: criarFormaPagamentoPersonalizada,
};

export const fornecedoresRepositorio: FornecedoresRepositorio = {
  listar: listarFornecedores,
  obterPorId: obterFornecedorPorId,
  criar: criarFornecedor,
  atualizar: atualizarFornecedor,
  resolver: resolverFornecedor,
};

export const estoqueRepositorio: EstoqueRepositorio = {
  listarProdutos,
  obterProdutoPorId,
  listarMovimentos,
  criarProduto,
  registrarMovimento,
};

export type {
  CatalogoRepositorio,
  ContasRepositorio,
  EstoqueRepositorio,
  FornecedoresRepositorio,
  FuncionariosRepositorio,
  ItensProdutoRepositorio,
  ObrasRepositorio,
} from "./repositorios";
