import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { registrarLogAdmin } from "./adminLog.server";
import { ErroDeNegocio } from "./resultado.server";

type Tx = Prisma.TransactionClient;

/**
 * Vagas ocupadas de um plano comercial, numa definição só para o checkout, a confirmação do pagamento e a atribuição
 * manual: empresas no plano Ativo com a chave do plano, mais reservas de checkout ainda dentro do prazo (de empresas
 * que ainda não estão contadas). Assim uma vaga atribuída à mão e um checkout em andamento disputam o mesmo limite.
 * Quem chama deve segurar a linha do plano (SELECT ... FOR UPDATE) para a conferência e a gravação serem atômicas.
 */
export async function contarOcupacao(tx: Tx, chave: string, agoraIso: string, ignorar?: { empresaId?: string; reservaId?: string }): Promise<number> {
  const [empresas, reservas] = await Promise.all([
    tx.empresa.count({ where: { planoComercialChave: chave, plano: "ativo", id: ignorar?.empresaId ? { not: ignorar.empresaId } : undefined } }),
    tx.assinaturaComercial.count({
      where: {
        planoChave: chave,
        status: "reservada",
        reservaExpiraEm: { gt: agoraIso },
        id: ignorar?.reservaId ? { not: ignorar.reservaId } : undefined,
        empresaId: ignorar?.empresaId ? { not: ignorar.empresaId } : undefined,
        // Empresa que já ocupa o plano foi contada acima; a reserva dela (ex.: o anual depois do mensal) não ocupa outra vaga.
        empresa: { OR: [{ planoComercialChave: null }, { planoComercialChave: { not: chave } }, { plano: { not: "ativo" } }] },
      },
    }),
  ]);
  return empresas + reservas;
}

/**
 * Registra qual plano comercial a empresa contratou (ou tira, com chave nula). Só vale para empresa no plano ativo.
 * A conferência de vagas e a gravação acontecem na mesma transação, com a linha do plano travada: duas atribuições
 * simultâneas não passam do limite.
 */
export async function atribuirPlanoComercial(adminId: string, empresaId: string, chave: string | null, motivo: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const empresa = await tx.empresa.findUnique({ where: { id: empresaId }, select: { id: true, plano: true, planoComercialChave: true } });
    if (!empresa) throw new ErroDeNegocio("Empresa não encontrada.");
    if (chave !== null) {
      if (empresa.plano !== "ativo") throw new ErroDeNegocio("Só empresa no plano Ativo pode ter plano comercial. Troque o plano primeiro.");
      await tx.$queryRaw`SELECT "id" FROM "PlanoComercial" WHERE "chave" = ${chave} FOR UPDATE`;
      const plano = await tx.planoComercial.findUnique({ where: { chave }, select: { vagasTotal: true } });
      if (!plano) throw new ErroDeNegocio("Plano comercial não encontrado.");
      if (plano.vagasTotal !== null && empresa.planoComercialChave !== chave) {
        const ocupadas = await contarOcupacao(tx, chave, new Date().toISOString(), { empresaId: empresa.id });
        if (ocupadas >= plano.vagasTotal) throw new ErroDeNegocio("Este plano não tem mais vagas.");
      }
    }
    await tx.empresa.update({ where: { id: empresa.id }, data: { planoComercialChave: chave, atualizadoEm: new Date().toISOString() } });
    await registrarLogAdmin(tx, adminId, "empresa.definir_plano_comercial", "Empresa", empresa.id, { de: empresa.planoComercialChave, para: chave, motivo });
  });
}
