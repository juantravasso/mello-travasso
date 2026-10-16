-- CreateEnum
CREATE TYPE "EstadoRelacaoDb" AS ENUM ('confirmada', 'contestada');

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "emailConfirmadoEm" TEXT;

-- CreateTable
CREATE TABLE "TokenEmail" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "expiraEm" TEXT NOT NULL,
    "usadoEm" TEXT,
    "criadoEm" TEXT NOT NULL,

    CONSTRAINT "TokenEmail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificacaoRelacao" (
    "id" TEXT NOT NULL,
    "avaliacaoId" TEXT NOT NULL,
    "estado" "EstadoRelacaoDb" NOT NULL,
    "metodo" TEXT NOT NULL,
    "respondidaPorUsuarioId" TEXT NOT NULL,
    "respondidaEm" TEXT NOT NULL,

    CONSTRAINT "VerificacaoRelacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TokenEmail_tokenHash_key" ON "TokenEmail"("tokenHash");

-- CreateIndex
CREATE INDEX "TokenEmail_usuarioId_tipo_idx" ON "TokenEmail"("usuarioId", "tipo");

-- CreateIndex
CREATE UNIQUE INDEX "VerificacaoRelacao_avaliacaoId_key" ON "VerificacaoRelacao"("avaliacaoId");

-- CreateIndex
CREATE INDEX "VerificacaoRelacao_estado_respondidaEm_idx" ON "VerificacaoRelacao"("estado", "respondidaEm");

-- AddForeignKey
ALTER TABLE "TokenEmail" ADD CONSTRAINT "TokenEmail_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificacaoRelacao" ADD CONSTRAINT "VerificacaoRelacao_avaliacaoId_fkey" FOREIGN KEY ("avaliacaoId") REFERENCES "Avaliacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

