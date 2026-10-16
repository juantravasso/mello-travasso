-- AlterEnum
ALTER TYPE "StatusSolicitacaoDb" ADD VALUE 'revogada';

-- AlterTable
ALTER TABLE "Arquivo" ADD COLUMN     "sha256" TEXT;

-- CreateIndex
CREATE INDEX "Arquivo_solicitacaoId_idx" ON "Arquivo"("solicitacaoId");

-- CreateIndex
CREATE INDEX "SolicitacaoVerificacao_perfilId_idx" ON "SolicitacaoVerificacao"("perfilId");

-- CreateIndex
CREATE INDEX "SolicitacaoVerificacao_avaliacaoId_idx" ON "SolicitacaoVerificacao"("avaliacaoId");


-- Pedido pendente é o único sem data de decisão; cancelado, expirado, aprovado, recusado e revogado têm.
ALTER TABLE "SolicitacaoVerificacao" ADD CONSTRAINT "SolicitacaoVerificacao_decisao_chk" CHECK (("status" = 'pendente') = ("decididaEm" IS NULL));
