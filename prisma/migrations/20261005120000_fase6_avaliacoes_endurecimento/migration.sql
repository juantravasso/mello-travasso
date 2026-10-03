-- DropForeignKey
ALTER TABLE "Indicacao" DROP CONSTRAINT "Indicacao_indicadoPorEmpresaId_fkey";

-- DropForeignKey
ALTER TABLE "Notificacao" DROP CONSTRAINT "Notificacao_empresaId_fkey";

-- AlterTable
ALTER TABLE "PerfilPublico" ADD COLUMN     "indicadoPorEmpresaId" TEXT;

-- CreateIndex
CREATE INDEX "Avaliacao_status_perfilId_idx" ON "Avaliacao"("status", "perfilId");

-- AddForeignKey
ALTER TABLE "Indicacao" ADD CONSTRAINT "Indicacao_indicadoPorEmpresaId_fkey" FOREIGN KEY ("indicadoPorEmpresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notificacao" ADD CONSTRAINT "Notificacao_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Nota sempre de 1 a 5 (o zod já garante; o banco também).
ALTER TABLE "Avaliacao" ADD CONSTRAINT "Avaliacao_nota_faixa" CHECK ("nota" BETWEEN 1 AND 5);
ALTER TABLE "AvaliacaoHistorico" ADD CONSTRAINT "AvaliacaoHistorico_nota_faixa" CHECK ("nota" BETWEEN 1 AND 5);
