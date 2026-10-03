-- CreateEnum
CREATE TYPE "StatusAvaliacaoDb" AS ENUM ('publicada', 'oculta', 'removida');

-- CreateEnum
CREATE TYPE "StatusVerificacaoDb" AS ENUM ('nao_verificada', 'relacao_confirmada', 'relacao_comprovada');

-- AlterEnum
ALTER TYPE "StatusPerfilDb" ADD VALUE 'indicado';

-- AlterTable
ALTER TABLE "PerfilPublico" ADD COLUMN     "documentoIndicado" TEXT;

-- CreateTable
CREATE TABLE "Avaliacao" (
    "id" TEXT NOT NULL,
    "perfilId" TEXT NOT NULL,
    "avaliadorEmpresaId" TEXT NOT NULL,
    "avaliadorUsuarioId" TEXT NOT NULL,
    "nota" INTEGER NOT NULL,
    "comentario" TEXT,
    "pros" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "contras" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "StatusAvaliacaoDb" NOT NULL DEFAULT 'publicada',
    "statusVerificacao" "StatusVerificacaoDb" NOT NULL DEFAULT 'nao_verificada',
    "versao" INTEGER NOT NULL DEFAULT 1,
    "criadoEm" TEXT NOT NULL,
    "atualizadoEm" TEXT NOT NULL,
    "editadaEm" TEXT,

    CONSTRAINT "Avaliacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvaliacaoHistorico" (
    "id" TEXT NOT NULL,
    "avaliacaoId" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    "nota" INTEGER NOT NULL,
    "comentario" TEXT,
    "pros" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "contras" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "registradoPorUsuarioId" TEXT NOT NULL,
    "registradoEm" TEXT NOT NULL,

    CONSTRAINT "AvaliacaoHistorico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RespostaAvaliacao" (
    "id" TEXT NOT NULL,
    "avaliacaoId" TEXT NOT NULL,
    "autorEmpresaId" TEXT NOT NULL,
    "autorUsuarioId" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "criadoEm" TEXT NOT NULL,
    "atualizadoEm" TEXT NOT NULL,

    CONSTRAINT "RespostaAvaliacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Indicacao" (
    "id" TEXT NOT NULL,
    "perfilId" TEXT NOT NULL,
    "indicadoPorEmpresaId" TEXT NOT NULL,
    "criadoEm" TEXT NOT NULL,

    CONSTRAINT "Indicacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notificacao" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "href" TEXT NOT NULL,
    "lida" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TEXT NOT NULL,

    CONSTRAINT "Notificacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Avaliacao_perfilId_status_criadoEm_idx" ON "Avaliacao"("perfilId", "status", "criadoEm");

-- CreateIndex
CREATE INDEX "Avaliacao_avaliadorEmpresaId_idx" ON "Avaliacao"("avaliadorEmpresaId");

-- CreateIndex
CREATE UNIQUE INDEX "Avaliacao_avaliadorEmpresaId_perfilId_key" ON "Avaliacao"("avaliadorEmpresaId", "perfilId");

-- CreateIndex
CREATE UNIQUE INDEX "AvaliacaoHistorico_avaliacaoId_versao_key" ON "AvaliacaoHistorico"("avaliacaoId", "versao");

-- CreateIndex
CREATE UNIQUE INDEX "RespostaAvaliacao_avaliacaoId_key" ON "RespostaAvaliacao"("avaliacaoId");

-- CreateIndex
CREATE INDEX "Indicacao_perfilId_idx" ON "Indicacao"("perfilId");

-- CreateIndex
CREATE UNIQUE INDEX "Indicacao_indicadoPorEmpresaId_perfilId_key" ON "Indicacao"("indicadoPorEmpresaId", "perfilId");

-- CreateIndex
CREATE INDEX "Notificacao_empresaId_lida_criadoEm_idx" ON "Notificacao"("empresaId", "lida", "criadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "PerfilPublico_documentoIndicado_key" ON "PerfilPublico"("documentoIndicado");

-- AddForeignKey
ALTER TABLE "Avaliacao" ADD CONSTRAINT "Avaliacao_perfilId_fkey" FOREIGN KEY ("perfilId") REFERENCES "PerfilPublico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Avaliacao" ADD CONSTRAINT "Avaliacao_avaliadorEmpresaId_fkey" FOREIGN KEY ("avaliadorEmpresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvaliacaoHistorico" ADD CONSTRAINT "AvaliacaoHistorico_avaliacaoId_fkey" FOREIGN KEY ("avaliacaoId") REFERENCES "Avaliacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RespostaAvaliacao" ADD CONSTRAINT "RespostaAvaliacao_avaliacaoId_fkey" FOREIGN KEY ("avaliacaoId") REFERENCES "Avaliacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RespostaAvaliacao" ADD CONSTRAINT "RespostaAvaliacao_autorEmpresaId_fkey" FOREIGN KEY ("autorEmpresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Indicacao" ADD CONSTRAINT "Indicacao_perfilId_fkey" FOREIGN KEY ("perfilId") REFERENCES "PerfilPublico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Indicacao" ADD CONSTRAINT "Indicacao_indicadoPorEmpresaId_fkey" FOREIGN KEY ("indicadoPorEmpresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notificacao" ADD CONSTRAINT "Notificacao_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

