-- CreateEnum
CREATE TYPE "FinalidadeArquivoDb" AS ENUM ('logo', 'portfolio', 'documento');

-- CreateTable
CREATE TABLE "Arquivo" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "perfilId" TEXT,
    "finalidade" "FinalidadeArquivoDb" NOT NULL,
    "mime" TEXT NOT NULL,
    "tamanho" INTEGER NOT NULL,
    "dados" BYTEA NOT NULL,
    "criadoEm" TEXT NOT NULL,

    CONSTRAINT "Arquivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Servico" (
    "id" TEXT NOT NULL,
    "perfilId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "criadoEm" TEXT NOT NULL,

    CONSTRAINT "Servico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trabalho" (
    "id" TEXT NOT NULL,
    "perfilId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "servicoId" TEXT,
    "galeria" TEXT,
    "dataTrabalho" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "criadoEm" TEXT NOT NULL,
    "atualizadoEm" TEXT NOT NULL,

    CONSTRAINT "Trabalho_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrabalhoFoto" (
    "id" TEXT NOT NULL,
    "trabalhoId" TEXT NOT NULL,
    "arquivoId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "criadoEm" TEXT NOT NULL,

    CONSTRAINT "TrabalhoFoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Arquivo_perfilId_finalidade_idx" ON "Arquivo"("perfilId", "finalidade");

-- CreateIndex
CREATE INDEX "Arquivo_empresaId_idx" ON "Arquivo"("empresaId");

-- CreateIndex
CREATE INDEX "Servico_perfilId_ordem_idx" ON "Servico"("perfilId", "ordem");

-- CreateIndex
CREATE INDEX "Trabalho_perfilId_ordem_idx" ON "Trabalho"("perfilId", "ordem");

-- CreateIndex
CREATE UNIQUE INDEX "TrabalhoFoto_arquivoId_key" ON "TrabalhoFoto"("arquivoId");

-- CreateIndex
CREATE INDEX "TrabalhoFoto_trabalhoId_ordem_idx" ON "TrabalhoFoto"("trabalhoId", "ordem");

-- AddForeignKey
ALTER TABLE "Arquivo" ADD CONSTRAINT "Arquivo_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Arquivo" ADD CONSTRAINT "Arquivo_perfilId_fkey" FOREIGN KEY ("perfilId") REFERENCES "PerfilPublico"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Servico" ADD CONSTRAINT "Servico_perfilId_fkey" FOREIGN KEY ("perfilId") REFERENCES "PerfilPublico"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trabalho" ADD CONSTRAINT "Trabalho_perfilId_fkey" FOREIGN KEY ("perfilId") REFERENCES "PerfilPublico"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trabalho" ADD CONSTRAINT "Trabalho_servicoId_fkey" FOREIGN KEY ("servicoId") REFERENCES "Servico"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrabalhoFoto" ADD CONSTRAINT "TrabalhoFoto_trabalhoId_fkey" FOREIGN KEY ("trabalhoId") REFERENCES "Trabalho"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrabalhoFoto" ADD CONSTRAINT "TrabalhoFoto_arquivoId_fkey" FOREIGN KEY ("arquivoId") REFERENCES "Arquivo"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Arquivo pequeno: o servidor também limita, o banco é a última barreira.
ALTER TABLE "Arquivo" ADD CONSTRAINT "Arquivo_tamanho_max" CHECK ("tamanho" > 0 AND "tamanho" <= 1048576);
