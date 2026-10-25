import "server-only";
import type { Prisma } from "@prisma/client";
import type { prisma } from "@/lib/prisma";
import { configuracaoPadrao, type ConfiguracaoForma } from "@/lib/formaPagamento";

type Db = Prisma.TransactionClient | typeof prisma;

/** Configuração que vale para a forma de pagamento da conta: a da empresa, ou o padrão se ela nunca mexeu. */
export async function configuracaoDaForma(db: Db, empresaId: string, chave: string | null | undefined): Promise<ConfiguracaoForma> {
  if (!chave) return { baixaAutomatica: false, diaVencimento: null };
  const linha = await db.configuracaoFormaPagamento.findUnique({ where: { empresaId_chave: { empresaId, chave } } });
  return linha ? { baixaAutomatica: linha.baixaAutomatica, diaVencimento: linha.diaVencimento } : configuracaoPadrao(chave);
}
