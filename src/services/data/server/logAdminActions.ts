"use server";

import { prisma } from "@/lib/prisma";
import { exigirAdminAction } from "@/lib/auth/dal";
import type { PaginaLogsAdmin } from "@/types";

const TAMANHO_PAGINA = 30;

/** Trilha de auditoria da administração, do mais recente para o mais antigo. */
export async function listarLogsAdmin(pagina?: number): Promise<PaginaLogsAdmin> {
  await exigirAdminAction();
  const numero = typeof pagina === "number" && Number.isInteger(pagina) && pagina >= 1 && pagina <= 5000 ? pagina : 1;

  const [total, registros] = await Promise.all([
    prisma.logAdmin.count(),
    prisma.logAdmin.findMany({
      orderBy: [{ criadoEm: "desc" }, { id: "asc" }],
      skip: (numero - 1) * TAMANHO_PAGINA,
      take: TAMANHO_PAGINA,
    }),
  ]);

  const adminIds = [...new Set(registros.map((l) => l.adminUsuarioId))];
  const admins = adminIds.length
    ? await prisma.usuario.findMany({ where: { id: { in: adminIds } }, select: { id: true, nome: true } })
    : [];
  const nomes = new Map(admins.map((a) => [a.id, a.nome]));

  return {
    pagina: numero,
    totalPaginas: Math.ceil(total / TAMANHO_PAGINA),
    itens: registros.map((l) => ({
      id: l.id,
      acao: l.acao,
      alvoTipo: l.alvoTipo,
      alvoId: l.alvoId ?? undefined,
      detalhes: JSON.stringify(l.detalhes),
      criadoEm: l.criadoEm,
      adminNome: nomes.get(l.adminUsuarioId) ?? "Administrador removido",
    })),
  };
}
