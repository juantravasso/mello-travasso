import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { TipoEvento } from "@/lib/cicloDeVida/eventos";

// Registro de eventos de produto (métricas). Idempotente quando há `chave`: o mesmo evento nunca conta duas vezes,
// mesmo que a página recarregue, o agendador rode em paralelo ou um webhook chegue repetido.

type Banco = Pick<Prisma.TransactionClient, "eventoProduto">;

export interface NovoEvento {
  tipo: TipoEvento;
  empresaId?: string | null;
  usuarioId?: string | null;
  /** Identifica o fato (ex.: `encerrado:<empresa>:<fim>`). Repetir a mesma chave não cria outro evento. */
  chave?: string;
  /** Só dados mínimos e sem conteúdo sensível (ids, nomes de campanha, contadores). */
  dados?: Prisma.InputJsonValue;
  agora?: Date;
}

/** true se este registro criou o evento; false se a chave já existia. */
export async function registrarEvento(db: Banco, e: NovoEvento): Promise<boolean> {
  const data = {
    tipo: e.tipo,
    empresaId: e.empresaId ?? null,
    usuarioId: e.usuarioId ?? null,
    chave: e.chave ?? null,
    dados: e.dados ?? undefined,
    criadoEm: (e.agora ?? new Date()).toISOString(),
  };
  if (!e.chave) {
    await db.eventoProduto.create({ data });
    return true;
  }
  const r = await db.eventoProduto.createMany({ data: [data], skipDuplicates: true });
  return r.count === 1;
}

/**
 * Para os pontos em que a métrica não pode derrubar a ação do usuário (cadastro, login): o erro vira log
 * (só o tipo, sem dados) e a ação segue.
 */
export async function registrarEventoSeguro(e: NovoEvento): Promise<void> {
  try {
    await registrarEvento(prisma, e);
  } catch (erro) {
    console.error("[eventos] falha ao registrar", e.tipo, erro instanceof Error ? erro.name : "erro");
  }
}
