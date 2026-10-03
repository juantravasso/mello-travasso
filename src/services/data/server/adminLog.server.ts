import "server-only";
import type { Prisma } from "@prisma/client";

/**
 * Registra uma ação da administração. Sempre dentro da mesma transação da
 * mudança que descreve, para o log nunca divergir do que de fato aconteceu.
 * `detalhes` guarda só o necessário (ids, valores antes/depois de campos de
 * catálogo) — nunca senha, token ou documento.
 */
export async function registrarLogAdmin(
  tx: Prisma.TransactionClient,
  adminUsuarioId: string,
  acao: string,
  alvoTipo: string,
  alvoId: string | null,
  detalhes: Prisma.InputJsonValue,
): Promise<void> {
  await tx.logAdmin.create({
    data: { adminUsuarioId, acao, alvoTipo, alvoId, detalhes, criadoEm: new Date().toISOString() },
  });
}
