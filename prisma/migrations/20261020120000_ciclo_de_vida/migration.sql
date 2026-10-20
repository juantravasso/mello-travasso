-- Ciclo de vida do cliente: configuração editável, extensões auditadas do teste, eventos de produto, fila de e-mails
-- e preferência de comunicação. Só cria tabelas novas e adiciona colunas com padrão em Usuario. Nenhum dado existente
-- é alterado ou apagado. O token de descadastro é gerado pelo banco para cada usuário que já existe.

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "emailsPromocionais" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "tokenDescadastro" TEXT NOT NULL DEFAULT (gen_random_uuid())::text;

-- CreateTable
CREATE TABLE "ConfiguracaoPlataforma" (
    "chave" TEXT NOT NULL,
    "valor" JSONB NOT NULL,
    "atualizadoEm" TEXT NOT NULL,
    "atualizadoPorId" TEXT,

    CONSTRAINT "ConfiguracaoPlataforma_pkey" PRIMARY KEY ("chave")
);

-- CreateTable
CREATE TABLE "ExtensaoTeste" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "dias" INTEGER NOT NULL,
    "motivo" TEXT NOT NULL,
    "concedidaPorId" TEXT NOT NULL,
    "fimAnterior" TEXT NOT NULL,
    "fimNovo" TEXT NOT NULL,
    "criadoEm" TEXT NOT NULL,

    CONSTRAINT "ExtensaoTeste_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventoProduto" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT,
    "usuarioId" TEXT,
    "tipo" TEXT NOT NULL,
    "chave" TEXT,
    "dados" JSONB,
    "criadoEm" TEXT NOT NULL,

    CONSTRAINT "EventoProduto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailAgendado" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "campanha" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "referencia" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "proximaTentativaEm" TEXT NOT NULL,
    "reservadoAte" TEXT,
    "enviadoEm" TEXT,
    "ultimoErro" TEXT,
    "criadoEm" TEXT NOT NULL,
    "atualizadoEm" TEXT NOT NULL,

    CONSTRAINT "EmailAgendado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_tokenDescadastro_key" ON "Usuario"("tokenDescadastro");

-- CreateIndex
CREATE INDEX "ExtensaoTeste_empresaId_criadoEm_idx" ON "ExtensaoTeste"("empresaId", "criadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "EventoProduto_chave_key" ON "EventoProduto"("chave");

-- CreateIndex
CREATE INDEX "EventoProduto_tipo_criadoEm_idx" ON "EventoProduto"("tipo", "criadoEm");

-- CreateIndex
CREATE INDEX "EventoProduto_empresaId_criadoEm_idx" ON "EventoProduto"("empresaId", "criadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "EmailAgendado_chave_key" ON "EmailAgendado"("chave");

-- CreateIndex
CREATE INDEX "EmailAgendado_status_proximaTentativaEm_idx" ON "EmailAgendado"("status", "proximaTentativaEm");

-- CreateIndex
CREATE INDEX "EmailAgendado_usuarioId_categoria_enviadoEm_idx" ON "EmailAgendado"("usuarioId", "categoria", "enviadoEm");

-- CreateIndex
CREATE INDEX "EmailAgendado_empresaId_idx" ON "EmailAgendado"("empresaId");

-- AddForeignKey
ALTER TABLE "ExtensaoTeste" ADD CONSTRAINT "ExtensaoTeste_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailAgendado" ADD CONSTRAINT "EmailAgendado_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailAgendado" ADD CONSTRAINT "EmailAgendado_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
