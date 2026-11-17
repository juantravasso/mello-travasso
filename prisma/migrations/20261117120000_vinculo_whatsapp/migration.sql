-- CreateTable
CREATE TABLE "VinculoWhatsapp" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "codigoHash" TEXT,
    "codigoExpiraEm" TEXT,
    "chatId" TEXT,
    "numero" TEXT,
    "verificadoEm" TEXT,
    "avisosAtivos" BOOLEAN NOT NULL DEFAULT true,
    "ultimaMensagemEm" TEXT,
    "criadoEm" TEXT NOT NULL,
    "atualizadoEm" TEXT NOT NULL,

    CONSTRAINT "VinculoWhatsapp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VinculoWhatsapp_usuarioId_key" ON "VinculoWhatsapp"("usuarioId");
CREATE UNIQUE INDEX "VinculoWhatsapp_codigoHash_key" ON "VinculoWhatsapp"("codigoHash");
CREATE UNIQUE INDEX "VinculoWhatsapp_chatId_key" ON "VinculoWhatsapp"("chatId");

-- AddForeignKey
ALTER TABLE "VinculoWhatsapp" ADD CONSTRAINT "VinculoWhatsapp_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
