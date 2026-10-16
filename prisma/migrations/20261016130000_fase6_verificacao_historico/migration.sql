-- CreateTable
CREATE TABLE "VerificacaoRelacaoHistorico" (
    "id" TEXT NOT NULL,
    "avaliacaoId" TEXT NOT NULL,
    "estado" "EstadoRelacaoDb" NOT NULL,
    "metodo" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "registradoEm" TEXT NOT NULL,

    CONSTRAINT "VerificacaoRelacaoHistorico_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VerificacaoRelacaoHistorico_avaliacaoId_registradoEm_idx" ON "VerificacaoRelacaoHistorico"("avaliacaoId", "registradoEm");

-- AddForeignKey
ALTER TABLE "VerificacaoRelacaoHistorico" ADD CONSTRAINT "VerificacaoRelacaoHistorico_avaliacaoId_fkey" FOREIGN KEY ("avaliacaoId") REFERENCES "Avaliacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

