"use server";

import { headers } from "next/headers";
import { exigirGestaoEscritaAction } from "@/lib/auth/dal";
import { extrairIpConfiavel } from "@/lib/auth/limite";
import { ACESSO } from "@/lib/auth/modulos";
import { urlDoSite } from "@/lib/rede/site";
import type { ConviteFuncionarioCriado, ConviteFuncionarioItem, ConvitePublicoFuncionario, Funcionario, ResultadoAction } from "@/types";
import * as core from "./conviteFuncionarioCore.server";
import { executar } from "./resultado.server";

// Cadastro de funcionário por link. Quem gera, lista, aprova e recusa é quem escreve em Funcionários (sessão); a página
// pública só lê e envia com o token do link. A regra está em conviteFuncionarioCore.server.ts.

async function contexto() {
  const sessao = await exigirGestaoEscritaAction(...ACESSO.funcionariosEscrever);
  return { empresaId: sessao.empresaId, nome: sessao.nome };
}

export async function criarConviteFuncionario(entrada: unknown): Promise<ResultadoAction<ConviteFuncionarioCriado>> {
  return executar(async () => core.criarConvite(await contexto(), entrada, urlDoSite()));
}

export async function listarConvitesFuncionario(): Promise<ResultadoAction<ConviteFuncionarioItem[]>> {
  return executar(async () => core.listarConvites(await contexto()));
}

export async function cancelarConviteFuncionario(id: string): Promise<ResultadoAction<null>> {
  return executar(async () => {
    await core.cancelarConvite(await contexto(), id);
    return null;
  });
}

export async function recusarConviteFuncionario(id: string): Promise<ResultadoAction<null>> {
  return executar(async () => {
    await core.recusarConvite(await contexto(), id);
    return null;
  });
}

export async function aprovarConviteFuncionario(id: string, entrada: unknown): Promise<ResultadoAction<Funcionario>> {
  return executar(async () => core.aprovarConvite(await contexto(), id, entrada));
}

// Sem sessão: a página do link.

export async function consultarConviteFuncionario(token: string): Promise<ConvitePublicoFuncionario> {
  return core.obterConvitePublico(token, extrairIpConfiavel(await headers()));
}

export async function enviarCadastroFuncionario(token: string, entrada: unknown): Promise<ResultadoAction<null>> {
  return executar(async () => {
    await core.enviarCadastroPublico(token, entrada, extrairIpConfiavel(await headers()));
    return null;
  });
}
