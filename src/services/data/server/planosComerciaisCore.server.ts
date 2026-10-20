import "server-only";
import { prisma } from "@/lib/prisma";
import { registrarLogAdmin } from "./adminLog.server";
import { ErroDeNegocio } from "./resultado.server";

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
        const ocupadas = await tx.empresa.count({ where: { planoComercialChave: chave, plano: "ativo" } });
        if (ocupadas >= plano.vagasTotal) throw new ErroDeNegocio("Este plano não tem mais vagas.");
      }
    }
    await tx.empresa.update({ where: { id: empresa.id }, data: { planoComercialChave: chave, atualizadoEm: new Date().toISOString() } });
    await registrarLogAdmin(tx, adminId, "empresa.definir_plano_comercial", "Empresa", empresa.id, { de: empresa.planoComercialChave, para: chave, motivo });
  });
}
