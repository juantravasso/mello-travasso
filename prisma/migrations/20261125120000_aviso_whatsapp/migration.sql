-- CreateTable
CREATE TABLE "AvisoWhatsapp" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "proximaTentativaEm" TEXT NOT NULL,
    "expiraEm" TEXT NOT NULL,
    "reservadoAte" TEXT,
    "enviadoEm" TEXT,
    "ultimoErro" TEXT,
    "criadoEm" TEXT NOT NULL,
    "atualizadoEm" TEXT NOT NULL,

    CONSTRAINT "AvisoWhatsapp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AvisoWhatsapp_chave_key" ON "AvisoWhatsapp"("chave");
CREATE INDEX "AvisoWhatsapp_status_proximaTentativaEm_idx" ON "AvisoWhatsapp"("status", "proximaTentativaEm");
CREATE INDEX "AvisoWhatsapp_status_enviadoEm_idx" ON "AvisoWhatsapp"("status", "enviadoEm");
CREATE INDEX "AvisoWhatsapp_usuarioId_idx" ON "AvisoWhatsapp"("usuarioId");
CREATE INDEX "AvisoWhatsapp_empresaId_idx" ON "AvisoWhatsapp"("empresaId");

-- AddForeignKey
ALTER TABLE "AvisoWhatsapp" ADD CONSTRAINT "AvisoWhatsapp_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AvisoWhatsapp" ADD CONSTRAINT "AvisoWhatsapp_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
