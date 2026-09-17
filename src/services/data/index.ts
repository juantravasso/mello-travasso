import { ContasRepositorioLocal } from "./contasRepositorio.local";
import { FuncionariosRepositorioLocal } from "./funcionariosRepositorio.local";
import { ItensProdutoRepositorioLocal } from "./itensProdutoRepositorio.local";
import { semearBancoSeVazio } from "./localDb";
import { ObrasRepositorioLocal } from "./obrasRepositorio.local";
import type {
  ContasRepositorio,
  FuncionariosRepositorio,
  ItensProdutoRepositorio,
  ObrasRepositorio,
} from "./repositorios";
import { contasSeed, funcionariosSeed, itensProdutoSeed, obrasSeed } from "./seed";

/**
 * Ponto único de acesso à camada de dados. Troque estas instâncias por
 * implementações HTTP (ex.: ObrasRepositorioHttp) quando o backend/banco
 * de dados estiver pronto — o restante do app usa só as interfaces em
 * ./repositorios e não precisa mudar.
 */
export const obrasRepositorio: ObrasRepositorio = new ObrasRepositorioLocal();
export const contasRepositorio: ContasRepositorio = new ContasRepositorioLocal();
export const itensProdutoRepositorio: ItensProdutoRepositorio = new ItensProdutoRepositorioLocal();
export const funcionariosRepositorio: FuncionariosRepositorio = new FuncionariosRepositorioLocal();

export function garantirDadosDeExemplo(): void {
  semearBancoSeVazio({
    obras: obrasSeed,
    contas: contasSeed,
    itensProduto: itensProdutoSeed,
    funcionarios: funcionariosSeed,
  });
}

export type {
  ContasRepositorio,
  FuncionariosRepositorio,
  ItensProdutoRepositorio,
  ObrasRepositorio,
} from "./repositorios";
