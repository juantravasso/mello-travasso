-- CreateEnum
CREATE TYPE "PapelPlataformaDb" AS ENUM ('admin');

-- CreateEnum
CREATE TYPE "TipoPerfilDb" AS ENUM ('pj', 'pf');

-- CreateEnum
CREATE TYPE "StatusPerfilDb" AS ENUM ('rascunho', 'publicado', 'suspenso');

-- AlterEnum
ALTER TYPE "PlanoDb" ADD VALUE 'gratuito';

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "papelPlataforma" "PapelPlataformaDb";

-- CreateTable
CREATE TABLE "Categoria" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "paiId" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TEXT NOT NULL,
    "atualizadoEm" TEXT NOT NULL,

    CONSTRAINT "Categoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Profissao" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "categoriaId" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TEXT NOT NULL,
    "atualizadoEm" TEXT NOT NULL,

    CONSTRAINT "Profissao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerfilPublico" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "tipo" "TipoPerfilDb" NOT NULL,
    "status" "StatusPerfilDb" NOT NULL DEFAULT 'rascunho',
    "nome" TEXT NOT NULL,
    "nomeFantasia" TEXT,
    "razaoSocial" TEXT,
    "descricao" TEXT,
    "nomeBusca" TEXT NOT NULL,
    "cidadeBusca" TEXT,
    "pais" TEXT NOT NULL DEFAULT 'BR',
    "estado" TEXT,
    "cidade" TEXT,
    "regiao" TEXT,
    "areasAtendimento" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "telefone" TEXT,
    "telefonePublico" BOOLEAN NOT NULL DEFAULT false,
    "whatsapp" TEXT,
    "whatsappPublico" BOOLEAN NOT NULL DEFAULT false,
    "instagram" TEXT,
    "site" TEXT,
    "empresaId" TEXT,
    "criadoEm" TEXT NOT NULL,
    "atualizadoEm" TEXT NOT NULL,

    CONSTRAINT "PerfilPublico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerfilProfissao" (
    "perfilId" TEXT NOT NULL,
    "profissaoId" TEXT NOT NULL,

    CONSTRAINT "PerfilProfissao_pkey" PRIMARY KEY ("perfilId","profissaoId")
);

-- CreateTable
CREATE TABLE "Recurso" (
    "chave" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,

    CONSTRAINT "Recurso_pkey" PRIMARY KEY ("chave")
);

-- CreateTable
CREATE TABLE "PlanoRecurso" (
    "plano" TEXT NOT NULL,
    "recursoChave" TEXT NOT NULL,

    CONSTRAINT "PlanoRecurso_pkey" PRIMARY KEY ("plano","recursoChave")
);

-- CreateTable
CREATE TABLE "LogAdmin" (
    "id" TEXT NOT NULL,
    "adminUsuarioId" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "alvoTipo" TEXT NOT NULL,
    "alvoId" TEXT,
    "detalhes" JSONB NOT NULL,
    "criadoEm" TEXT NOT NULL,

    CONSTRAINT "LogAdmin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Categoria_slug_key" ON "Categoria"("slug");

-- CreateIndex
CREATE INDEX "Categoria_paiId_idx" ON "Categoria"("paiId");

-- CreateIndex
CREATE UNIQUE INDEX "Profissao_slug_key" ON "Profissao"("slug");

-- CreateIndex
CREATE INDEX "Profissao_categoriaId_idx" ON "Profissao"("categoriaId");

-- CreateIndex
CREATE UNIQUE INDEX "PerfilPublico_slug_key" ON "PerfilPublico"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "PerfilPublico_empresaId_key" ON "PerfilPublico"("empresaId");

-- CreateIndex
CREATE INDEX "PerfilPublico_status_estado_cidadeBusca_idx" ON "PerfilPublico"("status", "estado", "cidadeBusca");

-- CreateIndex
CREATE INDEX "PerfilPublico_status_criadoEm_idx" ON "PerfilPublico"("status", "criadoEm");

-- CreateIndex
CREATE INDEX "PerfilProfissao_profissaoId_idx" ON "PerfilProfissao"("profissaoId");

-- CreateIndex
CREATE INDEX "LogAdmin_adminUsuarioId_idx" ON "LogAdmin"("adminUsuarioId");

-- CreateIndex
CREATE INDEX "LogAdmin_alvoTipo_alvoId_idx" ON "LogAdmin"("alvoTipo", "alvoId");

-- CreateIndex
CREATE INDEX "LogAdmin_criadoEm_idx" ON "LogAdmin"("criadoEm");

-- AddForeignKey
ALTER TABLE "Categoria" ADD CONSTRAINT "Categoria_paiId_fkey" FOREIGN KEY ("paiId") REFERENCES "Categoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Profissao" ADD CONSTRAINT "Profissao_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerfilPublico" ADD CONSTRAINT "PerfilPublico_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerfilProfissao" ADD CONSTRAINT "PerfilProfissao_perfilId_fkey" FOREIGN KEY ("perfilId") REFERENCES "PerfilPublico"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerfilProfissao" ADD CONSTRAINT "PerfilProfissao_profissaoId_fkey" FOREIGN KEY ("profissaoId") REFERENCES "Profissao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanoRecurso" ADD CONSTRAINT "PlanoRecurso_recursoChave_fkey" FOREIGN KEY ("recursoChave") REFERENCES "Recurso"("chave") ON DELETE CASCADE ON UPDATE CASCADE;

-- Dados de referência: recursos e quais planos os têm. "gestao" reúne os
-- módulos que já existiam (obras, contas, estoque, etc.); todos os planos
-- anteriores continuam com ele, então nada muda para quem já usa o sistema.
-- "gratuito" só tem "rede".
INSERT INTO "Recurso" ("chave", "nome", "descricao") VALUES
  ('rede', 'Rede profissional', 'Perfil público, busca, avaliações e indicações.'),
  ('gestao', 'Gestão', 'Obras, contas a pagar e receber, estoque, funcionários, fornecedores, captura de documentos e dashboard.');

INSERT INTO "PlanoRecurso" ("plano", "recursoChave") VALUES
  ('teste', 'rede'), ('teste', 'gestao'),
  ('cortesia', 'rede'), ('cortesia', 'gestao'),
  ('ativo', 'rede'), ('ativo', 'gestao'),
  ('suspenso', 'rede'), ('suspenso', 'gestao'),
  ('gratuito', 'rede');
