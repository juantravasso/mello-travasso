-- CreateEnum
CREATE TYPE "PapelDb" AS ENUM ('dono', 'membro');

-- CreateTable
CREATE TABLE "Empresa" (
    "id" TEXT NOT NULL,
    "documento" TEXT NOT NULL,
    "razaoSocial" TEXT NOT NULL,
    "criadoEm" TEXT NOT NULL,
    "atualizadoEm" TEXT NOT NULL,

    CONSTRAINT "Empresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "papel" "PapelDb" NOT NULL DEFAULT 'dono',
    "trocarSenha" BOOLEAN NOT NULL DEFAULT false,
    "falhasLogin" INTEGER NOT NULL DEFAULT 0,
    "bloqueadoAte" TEXT,
    "criadoEm" TEXT NOT NULL,
    "atualizadoEm" TEXT NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sessao" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "expiraEm" TEXT NOT NULL,
    "criadoEm" TEXT NOT NULL,
    "ultimoUsoEm" TEXT NOT NULL,

    CONSTRAINT "Sessao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LimiteTaxa" (
    "chave" TEXT NOT NULL,
    "janelaInicio" TEXT NOT NULL,
    "contagem" INTEGER NOT NULL,

    CONSTRAINT "LimiteTaxa_pkey" PRIMARY KEY ("chave")
);

-- CreateIndex
CREATE UNIQUE INDEX "Empresa_documento_key" ON "Empresa"("documento");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE INDEX "Usuario_empresaId_idx" ON "Usuario"("empresaId");

-- CreateIndex
CREATE INDEX "Sessao_usuarioId_idx" ON "Sessao"("usuarioId");

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sessao" ADD CONSTRAINT "Sessao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
