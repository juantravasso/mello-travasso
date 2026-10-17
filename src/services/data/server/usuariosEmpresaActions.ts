"use server";

import { exigirSessaoAction } from "@/lib/auth/dal";
import type { AcessoTemporario, ListaUsuariosEmpresa, ResultadoAction } from "@/types";
import type { ModuloChave } from "@/lib/auth/modulos";
import { executar } from "./resultado.server";
import * as core from "./usuariosEmpresaCore.server";

// Gestão de usuários da empresa. Só o DONO cria, muda os módulos, redefine e desativa; quem entra é sempre
// "membro" e só usa os módulos que o dono liberou. A regra está em usuariosEmpresaCore.server.ts; aqui só se
// confere quem chama e se devolve o resultado no formato das ações.

async function exigirDonoAction() {
  const sessao = await exigirSessaoAction();
  if (sessao.papel !== "dono") throw new Error("SEM_PERMISSAO");
  return sessao;
}

export async function listarUsuariosDaEmpresa(): Promise<ResultadoAction<ListaUsuariosEmpresa>> {
  return executar(async () => core.listar(await exigirDonoAction()));
}

export async function criarUsuarioDaEmpresa(input: unknown, senhaDoDono: string): Promise<ResultadoAction<AcessoTemporario>> {
  return executar(async () => core.criar(await exigirDonoAction(), input, senhaDoDono));
}

export async function alterarModulosDoUsuario(usuarioId: string, modulos: ModuloChave[], senhaDoDono: string): Promise<ResultadoAction<ModuloChave[]>> {
  return executar(async () => core.alterarModulos(await exigirDonoAction(), usuarioId, modulos, senhaDoDono));
}

export async function redefinirAcessoDoUsuario(usuarioId: string, senhaDoDono: string): Promise<ResultadoAction<AcessoTemporario>> {
  return executar(async () => core.redefinirAcesso(await exigirDonoAction(), usuarioId, senhaDoDono));
}

export async function desativarUsuarioDaEmpresa(usuarioId: string): Promise<ResultadoAction<null>> {
  return executar(async () => {
    await core.desativar(await exigirDonoAction(), usuarioId);
    return null;
  });
}

export async function reativarUsuarioDaEmpresa(usuarioId: string): Promise<ResultadoAction<null>> {
  return executar(async () => {
    await core.reativar(await exigirDonoAction(), usuarioId);
    return null;
  });
}
