"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { exigirGestaoAction, exigirGestaoEscritaAction } from "@/lib/auth/dal";
import { ACESSO } from "@/lib/auth/modulos";
import { formasPagamento, rotulosFormaPagamento } from "@/lib/categorias";
import { configuracaoPadrao, type FormaPagamentoConfigurada } from "@/lib/formaPagamento";
import type { ResultadoAction } from "@/types";
import { ErroDeNegocio, executar } from "./resultado.server";

// Configuração das formas de pagamento da empresa (baixa automática e dia de vencimento). Só o dono altera: isso
// decide quando uma conta é dada como paga sem ninguém conferir.

const salvarSchema = z
  .object({
    chave: z.string().trim().min(1).max(100),
    baixaAutomatica: z.boolean(),
    diaVencimento: z.number().int().min(1).max(31).nullable(),
  })
  .strict();

export async function listarFormasPagamentoConfiguradas(): Promise<ResultadoAction<FormaPagamentoConfigurada[]>> {
  return executar(async () => {
    const sessao = await exigirGestaoAction(...ACESSO.catalogoLer);
    const [personalizadas, configuradas] = await Promise.all([
      prisma.formaPagamentoPersonalizada.findMany({ where: { empresaId: sessao.empresaId }, orderBy: { criadoEm: "asc" } }),
      prisma.configuracaoFormaPagamento.findMany({ where: { empresaId: sessao.empresaId } }),
    ]);
    const porChave = new Map(configuradas.map((c) => [c.chave, c]));
    const montar = (chave: string, rotulo: string, padrao: boolean): FormaPagamentoConfigurada => {
      const c = porChave.get(chave);
      const base = c ? { baixaAutomatica: c.baixaAutomatica, diaVencimento: c.diaVencimento } : configuracaoPadrao(chave);
      return { chave, rotulo, padrao, ...base };
    };
    return [
      ...formasPagamento.map((chave) => montar(chave, rotulosFormaPagamento[chave] ?? chave, true)),
      ...personalizadas.map((p) => montar(p.id, p.rotulo, false)),
    ];
  });
}

export async function salvarConfiguracaoFormaPagamento(entrada: { chave: string; baixaAutomatica: boolean; diaVencimento: number | null }): Promise<ResultadoAction<null>> {
  return executar(async () => {
    const sessao = await exigirGestaoEscritaAction(...ACESSO.catalogoEscrever);
    if (sessao.papel !== "dono") throw new ErroDeNegocio("Só o dono da empresa muda as formas de pagamento.");
    const parsed = salvarSchema.safeParse(entrada);
    if (!parsed.success) throw new ErroDeNegocio("Confira os dados: o dia do vencimento vai de 1 a 31.");
    const { chave, baixaAutomatica, diaVencimento } = parsed.data;

    // A chave é de uma forma padrão ou de uma forma criada por ESTA empresa (nunca de outra).
    if (!formasPagamento.includes(chave)) {
      const propria = await prisma.formaPagamentoPersonalizada.findFirst({ where: { id: chave, empresaId: sessao.empresaId }, select: { id: true } });
      if (!propria) throw new ErroDeNegocio("Forma de pagamento não encontrada.");
    }
    const atualizadoEm = new Date().toISOString();
    await prisma.configuracaoFormaPagamento.upsert({
      where: { empresaId_chave: { empresaId: sessao.empresaId, chave } },
      create: { empresaId: sessao.empresaId, chave, baixaAutomatica, diaVencimento, atualizadoEm },
      update: { baixaAutomatica, diaVencimento, atualizadoEm },
    });
    return null;
  });
}
