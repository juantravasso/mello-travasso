-- CreateEnum
CREATE TYPE "TipoVerificacaoDb" AS ENUM ('empresa_verificada', 'reivindicacao_perfil', 'relacao_comprovada');

-- CreateEnum
CREATE TYPE "StatusSolicitacaoDb" AS ENUM ('pendente', 'aprovada', 'recusada', 'cancelada', 'expirada');

-- AlterTable
ALTER TABLE "Arquivo" ADD COLUMN     "apagadoEm" TEXT,
ADD COLUMN     "cifrado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "solicitacaoId" TEXT;

-- AlterTable
ALTER TABLE "Empresa" ADD COLUMN     "verificadaEm" TEXT;

-- CreateTable
CREATE TABLE "SolicitacaoVerificacao" (
    "id" TEXT NOT NULL,
    "tipo" "TipoVerificacaoDb" NOT NULL,
    "status" "StatusSolicitacaoDb" NOT NULL DEFAULT 'pendente',
    "solicitanteEmpresaId" TEXT NOT NULL,
    "solicitanteUsuarioId" TEXT NOT NULL,
    "perfilId" TEXT,
    "avaliacaoId" TEXT,
    "observacao" TEXT,
    "decididaPorUsuarioId" TEXT,
    "decididaEm" TEXT,
    "motivoDecisao" TEXT,
    "criadoEm" TEXT NOT NULL,
    "atualizadoEm" TEXT NOT NULL,

    CONSTRAINT "SolicitacaoVerificacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SolicitacaoVerificacao_status_criadoEm_idx" ON "SolicitacaoVerificacao"("status", "criadoEm");

-- CreateIndex
CREATE INDEX "SolicitacaoVerificacao_solicitanteEmpresaId_status_idx" ON "SolicitacaoVerificacao"("solicitanteEmpresaId", "status");

-- AddForeignKey
ALTER TABLE "SolicitacaoVerificacao" ADD CONSTRAINT "SolicitacaoVerificacao_solicitanteEmpresaId_fkey" FOREIGN KEY ("solicitanteEmpresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitacaoVerificacao" ADD CONSTRAINT "SolicitacaoVerificacao_perfilId_fkey" FOREIGN KEY ("perfilId") REFERENCES "PerfilPublico"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitacaoVerificacao" ADD CONSTRAINT "SolicitacaoVerificacao_avaliacaoId_fkey" FOREIGN KEY ("avaliacaoId") REFERENCES "Avaliacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Arquivo" ADD CONSTRAINT "Arquivo_solicitacaoId_fkey" FOREIGN KEY ("solicitacaoId") REFERENCES "SolicitacaoVerificacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Cada tipo de pedido tem exatamente o seu alvo: perfil (reivindicação), avaliação (relação) ou nenhum (selo).
ALTER TABLE "SolicitacaoVerificacao" ADD CONSTRAINT "SolicitacaoVerificacao_alvo_chk" CHECK (
  ("tipo" = 'reivindicacao_perfil' AND "perfilId" IS NOT NULL AND "avaliacaoId" IS NULL)
  OR ("tipo" = 'relacao_comprovada' AND "avaliacaoId" IS NOT NULL AND "perfilId" IS NULL)
  OR ("tipo" = 'empresa_verificada' AND "perfilId" IS NULL AND "avaliacaoId" IS NULL)
);

-- Documento de verificação: sempre ligado a uma solicitação e sempre cifrado; nunca ligado a perfil público.
ALTER TABLE "Arquivo" ADD CONSTRAINT "Arquivo_documento_chk" CHECK (
  ("finalidade" = 'documento') = ("solicitacaoId" IS NOT NULL)
  AND ("finalidade" <> 'documento' OR ("cifrado" AND "perfilId" IS NULL))
);
