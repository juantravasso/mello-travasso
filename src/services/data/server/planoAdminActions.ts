"use server";

import { prisma } from "@/lib/prisma";
import { exigirAdminAction } from "@/lib/auth/dal";
import { recursosDoPlanoSchema } from "@/lib/validacao/admin";
import type { MatrizPlanos, PlanoEmpresa, ResultadoAction } from "@/types";
import { registrarLogAdmin } from "./adminLog.server";
import { exigirSenhaDoAdmin } from "./reautenticacao.server";
import { ErroDeNegocio, executar } from "./resultado.server";

const ORDEM_PLANOS: PlanoEmpresa[] = ["gratuito", "teste", "cortesia", "ativo", "suspenso"];
// Planos de quem usa o produto completo: um clique não pode trancar todos os clientes para fora.
const PLANOS_COMPLETOS = ["teste", "cortesia", "ativo"];
const RECURSOS_DO_PLANO_COMPLETO = ["rede", "gestao"];

/** Recursos de cada plano e quantas empresas há em cada um. */
export async function obterMatrizPlanos(): Promise<MatrizPlanos> {
  await exigirAdminAction();
  const [recursos, ligacoes, contagens] = await Promise.all([
    prisma.recurso.findMany({ orderBy: { chave: "asc" } }),
    prisma.planoRecurso.findMany(),
    prisma.empresa.groupBy({ by: ["plano"], _count: { _all: true } }),
  ]);
  return {
    recursos: recursos.map((r) => ({ chave: r.chave, nome: r.nome, descricao: r.descricao ?? undefined })),
    planos: ORDEM_PLANOS.map((plano) => ({
      plano,
      recursos: ligacoes.filter((l) => l.plano === plano).map((l) => l.recursoChave),
      empresas: contagens.find((c) => c.plano === plano)?._count._all ?? 0,
    })),
  };
}

/**
 * Define quais recursos um plano libera. Só aceita chaves que já existem em
 * Recurso (cada uma tem uma barreira própria no código; uma chave nova sem
 * código por trás não protegeria nada). O plano gratuito não pode perder a
 * rede: seria trancar para fora quem só usa a rede. A mudança vale na próxima
 * requisição de cada empresa.
 */
export async function salvarRecursosDoPlano(plano: string, recursos: string[], motivo: string, senha?: string): Promise<ResultadoAction<null>> {
  const admin = await exigirAdminAction();
  return executar(async () => {
    const parsed = recursosDoPlanoSchema.safeParse({ plano, recursos, motivo });
    if (!parsed.success) throw new ErroDeNegocio(parsed.error.issues[0]?.message ?? "Dados inválidos.");
    await exigirSenhaDoAdmin(admin.usuarioId, senha);
    const dados = parsed.data;
    if (dados.plano === "gratuito" && !dados.recursos.includes("rede")) {
      throw new ErroDeNegocio("O plano gratuito precisa manter a rede profissional.");
    }
    if (PLANOS_COMPLETOS.includes(dados.plano) && !RECURSOS_DO_PLANO_COMPLETO.every((c) => dados.recursos.includes(c))) {
      throw new ErroDeNegocio("Os planos de teste, cortesia e ativo precisam manter a rede e a gestão. Para barrar uma conta, bloqueie a empresa.");
    }

    await prisma.$transaction(async (tx) => {
      // Duas gravações do mesmo plano ao mesmo tempo (apaga e recria) se atropelariam: uma por vez.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`plano:${dados.plano}`}))`;
      const existentes = await tx.recurso.findMany({ select: { chave: true } });
      const chaves = new Set(existentes.map((r) => r.chave));
      if (dados.recursos.some((c) => !chaves.has(c))) throw new ErroDeNegocio("Algum recurso escolhido não existe.");
      const antes = (await tx.planoRecurso.findMany({ where: { plano: dados.plano }, select: { recursoChave: true } })).map((l) => l.recursoChave);
      await tx.planoRecurso.deleteMany({ where: { plano: dados.plano } });
      if (dados.recursos.length > 0) {
        await tx.planoRecurso.createMany({ data: dados.recursos.map((recursoChave) => ({ plano: dados.plano, recursoChave })) });
      }
      await registrarLogAdmin(tx, admin.usuarioId, "plano.alterar_recursos", "Plano", dados.plano, {
        antes: antes.sort(),
        depois: [...dados.recursos].sort(),
        motivo: dados.motivo,
      });
    });
    return null;
  });
}
