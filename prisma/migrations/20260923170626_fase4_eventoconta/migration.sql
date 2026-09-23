-- CreateTable
CREATE TABLE "EventoConta" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "detalhes" JSONB NOT NULL,
    "criadoEm" TEXT NOT NULL,

    CONSTRAINT "EventoConta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventoConta_empresaId_idx" ON "EventoConta"("empresaId");

-- AddForeignKey
ALTER TABLE "EventoConta" ADD CONSTRAINT "EventoConta_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
