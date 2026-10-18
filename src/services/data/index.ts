import type {
  CapturaRepositorio,
  DepositoRepositorio,
  CatalogoRepositorio,
  ContasRepositorio,
  EstoqueRepositorio,
  FornecedoresRepositorio,
  FuncionariosRepositorio,
  ItensProdutoRepositorio,
  ObrasRepositorio,
  AvaliacoesAdminRepositorio,
  DenunciasAdminRepositorio,
  EmpresasAdminRepositorio,
  LogsAdminRepositorio,
  PerfisAdminRepositorio,
  PlanosAdminRepositorio,
  PortfolioRepositorio,
  RedeRepositorio,
  TaxonomiaAdminRepositorio,
  UsuariosAdminRepositorio,
  UsuariosEmpresaRepositorio,
  ConviteRepositorio,
  CalendarioRepositorio,
  VerificacaoRepositorio,
  VerificacoesAdminRepositorio,
} from "./repositorios";
import { registrarCaptura } from "./server/capturaActions";
import { listarTransferencias, obterCustosTransferidos, obterDeposito, transferirDoDeposito } from "./server/depositoActions";
import { cancelarSolicitacao, criarSolicitacao, listarMinhasSolicitacoes, obterAvaliacaoComprovavel, obterPerfilReivindicavel } from "./server/verificacaoActions";
import { contarSolicitacoesPendentes, decidirSolicitacao, desfazerSolicitacao, listarSolicitacoesAdmin } from "./server/verificacaoAdminActions";
import { alterarPlanoEmpresa, bloquearEmpresa, desbloquearEmpresa, listarEmpresasAdmin } from "./server/empresaAdminActions";
import { obterMatrizPlanos, salvarRecursosDoPlano } from "./server/planoAdminActions";
import { bloquearUsuario, desbloquearUsuario, encerrarSessoesDoUsuario, listarUsuariosAdmin } from "./server/usuarioAdminActions";
import {
  atualizarCompromisso,
  criarCompromisso,
  excluirCompromisso,
  listarColegas,
  listarCompromissos,
  listarProximosCompromissos,
  obterCompromisso,
  obterPreferenciasCalendario,
  salvarFusoHorarioDaEmpresa,
  salvarPreferenciasCalendario,
} from "./server/calendarioActions";
import {
  alterarModulosDoUsuario,
  criarUsuarioDaEmpresa,
  desativarUsuarioDaEmpresa,
  listarUsuariosDaEmpresa,
  reativarUsuarioDaEmpresa,
  redefinirAcessoDoUsuario,
} from "./server/usuariosEmpresaActions";
import { obterConvite } from "./server/conviteActions";
import { listarAvaliacoesAdmin, moderarAvaliacao } from "./server/avaliacaoAdminActions";
import { complementarDenuncia, denunciar, listarMinhasDenuncias } from "./server/denunciaActions";
import {
  atualizarTrabalho,
  criarTrabalho,
  excluirFoto,
  excluirTrabalho,
  moverFoto,
  moverTrabalho,
  obterMeuPortfolio,
  removerLogo,
  salvarServicos,
} from "./server/portfolioActions";
import { assumirDenuncia, decidirDenuncia, listarDenunciasAdmin, solicitarInformacoes } from "./server/denunciaAdminActions";
import { listarLogsAdmin } from "./server/logAdminActions";
import { listarPerfisAdmin, reativarPerfil, suspenderPerfil } from "./server/perfilAdminActions";
import {
  atualizarCategoria,
  atualizarProfissao,
  criarCategoria,
  criarProfissao,
  excluirCategoria,
  excluirProfissao,
  listarTaxonomiaAdmin,
  listarTaxonomiaAtiva,
} from "./server/taxonomiaActions";
import { definirPublicacao, obterMeuPerfil, salvarMeuPerfil } from "./server/perfilRedeActions";
import {
  listarAvaliacoesFeitas,
  listarAvaliacoesRecebidas,
  obterAvaliacaoParaEditar,
  recomendarPerfil,
  removerRecomendacao,
  responderAvaliacao,
  responderRelacao,
  salvarAvaliacao,
} from "./server/avaliacaoActions";
import { confirmarEmail, reenviarConfirmacaoEmail } from "./server/emailActions";
import { indicarEmpresa, listarMinhasIndicacoes } from "./server/indicacaoActions";
import {
  contarNotificacoesNaoLidas,
  listarNotificacoes,
  marcarNotificacaoLida,
  marcarTodasNotificacoesLidas,
} from "./server/notificacaoActions";
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

export const capturaRepositorio: CapturaRepositorio = {
  registrar: registrarCaptura,
};

export const depositoRepositorio: DepositoRepositorio = {
  obter: obterDeposito,
  transferir: transferirDoDeposito,
  listarTransferencias,
  obterCustosTransferidos,
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

export const redeRepositorio: RedeRepositorio = {
  listarTaxonomia: listarTaxonomiaAtiva,
  obterMeuPerfil,
  salvarMeuPerfil,
  definirPublicacao,
  obterAvaliacaoParaEditar,
  salvarAvaliacao,
  listarAvaliacoesFeitas,
  listarAvaliacoesRecebidas,
  responderAvaliacao,
  responderRelacao,
  reenviarConfirmacaoEmail,
  confirmarEmail,
  recomendarPerfil,
  removerRecomendacao,
  indicarEmpresa,
  listarMinhasIndicacoes,
  listarNotificacoes,
  contarNotificacoesNaoLidas,
  marcarNotificacaoLida,
  marcarTodasNotificacoesLidas,
  denunciar,
  listarMinhasDenuncias,
  complementarDenuncia,
};

export const taxonomiaAdminRepositorio: TaxonomiaAdminRepositorio = {
  listar: listarTaxonomiaAdmin,
  criarCategoria,
  atualizarCategoria,
  excluirCategoria,
  criarProfissao,
  atualizarProfissao,
  excluirProfissao,
};

export const avaliacoesAdminRepositorio: AvaliacoesAdminRepositorio = {
  listar: listarAvaliacoesAdmin,
  moderar: moderarAvaliacao,
};

export const portfolioRepositorio: PortfolioRepositorio = {
  obter: obterMeuPortfolio,
  salvarServicos,
  criarTrabalho,
  atualizarTrabalho,
  excluirTrabalho,
  moverTrabalho,
  moverFoto,
  excluirFoto,
  removerLogo,
};

export const denunciasAdminRepositorio: DenunciasAdminRepositorio = {
  listar: listarDenunciasAdmin,
  assumir: assumirDenuncia,
  solicitarInformacoes,
  decidir: decidirDenuncia,
};

export const logsAdminRepositorio: LogsAdminRepositorio = {
  listar: listarLogsAdmin,
};

export const perfisAdminRepositorio: PerfisAdminRepositorio = {
  listar: listarPerfisAdmin,
  suspender: suspenderPerfil,
  reativar: reativarPerfil,
};

export const empresasAdminRepositorio: EmpresasAdminRepositorio = {
  listar: listarEmpresasAdmin,
  bloquear: bloquearEmpresa,
  desbloquear: desbloquearEmpresa,
  alterarPlano: alterarPlanoEmpresa,
};

export const usuariosAdminRepositorio: UsuariosAdminRepositorio = {
  listar: listarUsuariosAdmin,
  bloquear: bloquearUsuario,
  desbloquear: desbloquearUsuario,
  encerrarSessoes: encerrarSessoesDoUsuario,
};

export const calendarioRepositorio: CalendarioRepositorio = {
  listar: listarCompromissos,
  proximos: listarProximosCompromissos,
  obter: obterCompromisso,
  colegas: listarColegas,
  criar: criarCompromisso,
  atualizar: atualizarCompromisso,
  excluir: excluirCompromisso,
  obterPreferencias: obterPreferenciasCalendario,
  salvarPreferencias: salvarPreferenciasCalendario,
  salvarFuso: salvarFusoHorarioDaEmpresa,
};

export const usuariosEmpresaRepositorio: UsuariosEmpresaRepositorio = {
  listar: listarUsuariosDaEmpresa,
  criar: criarUsuarioDaEmpresa,
  alterarModulos: alterarModulosDoUsuario,
  redefinirAcesso: redefinirAcessoDoUsuario,
  desativar: desativarUsuarioDaEmpresa,
  reativar: reativarUsuarioDaEmpresa,
};

export const conviteRepositorio: ConviteRepositorio = {
  obter: obterConvite,
};

export const verificacaoRepositorio: VerificacaoRepositorio = {
  criar: criarSolicitacao,
  listarMinhas: listarMinhasSolicitacoes,
  cancelar: cancelarSolicitacao,
  obterPerfilReivindicavel,
  obterAvaliacaoComprovavel,
};

export const verificacoesAdminRepositorio: VerificacoesAdminRepositorio = {
  listar: listarSolicitacoesAdmin,
  contarPendentes: contarSolicitacoesPendentes,
  decidir: decidirSolicitacao,
  desfazer: desfazerSolicitacao,
};

export const planosAdminRepositorio: PlanosAdminRepositorio = {
  obter: obterMatrizPlanos,
  salvarRecursos: salvarRecursosDoPlano,
};

export type {
  CapturaRepositorio,
  DepositoRepositorio,
  CatalogoRepositorio,
  ContasRepositorio,
  EstoqueRepositorio,
  FornecedoresRepositorio,
  FuncionariosRepositorio,
  ItensProdutoRepositorio,
  ObrasRepositorio,
  AvaliacoesAdminRepositorio,
  DenunciasAdminRepositorio,
  EmpresasAdminRepositorio,
  LogsAdminRepositorio,
  PerfisAdminRepositorio,
  PlanosAdminRepositorio,
  PortfolioRepositorio,
  RedeRepositorio,
  TaxonomiaAdminRepositorio,
  UsuariosAdminRepositorio,
  UsuariosEmpresaRepositorio,
  CalendarioRepositorio,
  VerificacaoRepositorio,
  VerificacoesAdminRepositorio,
} from "./repositorios";
