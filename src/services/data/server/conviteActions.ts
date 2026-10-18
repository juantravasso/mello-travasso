"use server";

import { exigirSessaoAction } from "@/lib/auth/dal";
import { urlDoSite } from "@/lib/rede/site";
import type { ResultadoAction, ResumoConvite } from "@/types";
import { executar } from "./resultado.server";
import * as core from "./conviteCore.server";

// Link de convite da empresa. Só o DONO vê e compartilha; a regra está em conviteCore.server.ts.

export async function obterConvite(): Promise<ResultadoAction<ResumoConvite>> {
  return executar(async () => {
    const sessao = await exigirSessaoAction();
    if (sessao.papel !== "dono") throw new Error("SEM_PERMISSAO");
    return core.resumo(sessao.empresaId, urlDoSite());
  });
}
