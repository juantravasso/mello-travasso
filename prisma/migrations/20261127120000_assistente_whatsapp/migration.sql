-- CreateTable
CREATE TABLE "ConversaWhatsapp" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "mensagens" JSONB NOT NULL,
    "humanoAte" TEXT,
    "atualizadoEm" TEXT NOT NULL,
    "criadoEm" TEXT NOT NULL,

    CONSTRAINT "ConversaWhatsapp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcaoAssistente" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "mensagemId" TEXT,
    "resumoPedido" TEXT NOT NULL,
    "ferramenta" TEXT NOT NULL,
    "argumentos" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "registroId" TEXT,
    "detalhe" TEXT,
    "criadoEm" TEXT NOT NULL,

    CONSTRAINT "AcaoAssistente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConversaWhatsapp_usuarioId_key" ON "ConversaWhatsapp"("usuarioId");

-- CreateIndex
CREATE INDEX "ConversaWhatsapp_atualizadoEm_idx" ON "ConversaWhatsapp"("atualizadoEm");

-- CreateIndex
CREATE INDEX "AcaoAssistente_empresaId_criadoEm_idx" ON "AcaoAssistente"("empresaId", "criadoEm");

-- CreateIndex
CREATE INDEX "AcaoAssistente_usuarioId_criadoEm_idx" ON "AcaoAssistente"("usuarioId", "criadoEm");

-- AddForeignKey
ALTER TABLE "ConversaWhatsapp" ADD CONSTRAINT "ConversaWhatsapp_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversaWhatsapp" ADD CONSTRAINT "ConversaWhatsapp_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcaoAssistente" ADD CONSTRAINT "AcaoAssistente_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcaoAssistente" ADD CONSTRAINT "AcaoAssistente_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

