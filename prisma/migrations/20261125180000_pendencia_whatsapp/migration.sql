-- CreateTable
CREATE TABLE "PendenciaWhatsapp" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "etapa" TEXT NOT NULL,
    "dados" JSONB NOT NULL,
    "fotoDataUrl" TEXT NOT NULL,
    "expiraEm" TEXT NOT NULL,
    "criadoEm" TEXT NOT NULL,
    "atualizadoEm" TEXT NOT NULL,

    CONSTRAINT "PendenciaWhatsapp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PendenciaWhatsapp_usuarioId_key" ON "PendenciaWhatsapp"("usuarioId");
CREATE INDEX "PendenciaWhatsapp_empresaId_idx" ON "PendenciaWhatsapp"("empresaId");

-- AddForeignKey
ALTER TABLE "PendenciaWhatsapp" ADD CONSTRAINT "PendenciaWhatsapp_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PendenciaWhatsapp" ADD CONSTRAINT "PendenciaWhatsapp_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
