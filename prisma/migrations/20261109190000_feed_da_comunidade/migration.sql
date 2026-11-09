-- CreateEnum
CREATE TYPE "StatusPostagemDb" AS ENUM ('publicada', 'oculta', 'apagada');

-- AlterEnum
ALTER TYPE "FinalidadeArquivoDb" ADD VALUE 'postagem';

-- CreateTable
CREATE TABLE "Postagem" (
    "id" TEXT NOT NULL,
    "perfilId" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "status" "StatusPostagemDb" NOT NULL DEFAULT 'publicada',
    "motivoOcultacao" TEXT,
    "criadoEm" TEXT NOT NULL,
    "atualizadoEm" TEXT NOT NULL,

    CONSTRAINT "Postagem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostagemFoto" (
    "id" TEXT NOT NULL,
    "postagemId" TEXT NOT NULL,
    "arquivoId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "criadoEm" TEXT NOT NULL,

    CONSTRAINT "PostagemFoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostagemCurtida" (
    "postagemId" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "criadoEm" TEXT NOT NULL,

    CONSTRAINT "PostagemCurtida_pkey" PRIMARY KEY ("postagemId","empresaId")
);

-- CreateTable
CREATE TABLE "ComentarioPostagem" (
    "id" TEXT NOT NULL,
    "postagemId" TEXT NOT NULL,
    "perfilId" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "status" "StatusPostagemDb" NOT NULL DEFAULT 'publicada',
    "criadoEm" TEXT NOT NULL,

    CONSTRAINT "ComentarioPostagem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DenunciaPostagem" (
    "id" TEXT NOT NULL,
    "postagemId" TEXT NOT NULL,
    "comentarioId" TEXT,
    "alvoChave" TEXT NOT NULL,
    "denuncianteEmpresaId" TEXT NOT NULL,
    "denuncianteUsuarioId" TEXT NOT NULL,
    "motivo" "TipoDenunciaDb" NOT NULL,
    "descricao" TEXT NOT NULL,
    "criadoEm" TEXT NOT NULL,
    "decisao" TEXT,
    "resolvidaEm" TEXT,
    "adminResponsavelId" TEXT,

    CONSTRAINT "DenunciaPostagem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Postagem_status_criadoEm_id_idx" ON "Postagem"("status", "criadoEm", "id");

-- CreateIndex
CREATE INDEX "Postagem_perfilId_status_criadoEm_idx" ON "Postagem"("perfilId", "status", "criadoEm");

-- CreateIndex
CREATE INDEX "Postagem_empresaId_criadoEm_idx" ON "Postagem"("empresaId", "criadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "PostagemFoto_arquivoId_key" ON "PostagemFoto"("arquivoId");

-- CreateIndex
CREATE INDEX "PostagemFoto_postagemId_ordem_idx" ON "PostagemFoto"("postagemId", "ordem");

-- CreateIndex
CREATE INDEX "PostagemCurtida_empresaId_idx" ON "PostagemCurtida"("empresaId");

-- CreateIndex
CREATE INDEX "ComentarioPostagem_postagemId_status_criadoEm_idx" ON "ComentarioPostagem"("postagemId", "status", "criadoEm");

-- CreateIndex
CREATE INDEX "ComentarioPostagem_empresaId_criadoEm_idx" ON "ComentarioPostagem"("empresaId", "criadoEm");

-- CreateIndex
CREATE INDEX "DenunciaPostagem_resolvidaEm_criadoEm_idx" ON "DenunciaPostagem"("resolvidaEm", "criadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "DenunciaPostagem_denuncianteEmpresaId_alvoChave_key" ON "DenunciaPostagem"("denuncianteEmpresaId", "alvoChave");

-- AddForeignKey
ALTER TABLE "Postagem" ADD CONSTRAINT "Postagem_perfilId_fkey" FOREIGN KEY ("perfilId") REFERENCES "PerfilPublico"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Postagem" ADD CONSTRAINT "Postagem_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostagemFoto" ADD CONSTRAINT "PostagemFoto_postagemId_fkey" FOREIGN KEY ("postagemId") REFERENCES "Postagem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostagemFoto" ADD CONSTRAINT "PostagemFoto_arquivoId_fkey" FOREIGN KEY ("arquivoId") REFERENCES "Arquivo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostagemCurtida" ADD CONSTRAINT "PostagemCurtida_postagemId_fkey" FOREIGN KEY ("postagemId") REFERENCES "Postagem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostagemCurtida" ADD CONSTRAINT "PostagemCurtida_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComentarioPostagem" ADD CONSTRAINT "ComentarioPostagem_postagemId_fkey" FOREIGN KEY ("postagemId") REFERENCES "Postagem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComentarioPostagem" ADD CONSTRAINT "ComentarioPostagem_perfilId_fkey" FOREIGN KEY ("perfilId") REFERENCES "PerfilPublico"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComentarioPostagem" ADD CONSTRAINT "ComentarioPostagem_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DenunciaPostagem" ADD CONSTRAINT "DenunciaPostagem_postagemId_fkey" FOREIGN KEY ("postagemId") REFERENCES "Postagem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DenunciaPostagem" ADD CONSTRAINT "DenunciaPostagem_comentarioId_fkey" FOREIGN KEY ("comentarioId") REFERENCES "ComentarioPostagem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DenunciaPostagem" ADD CONSTRAINT "DenunciaPostagem_denuncianteEmpresaId_fkey" FOREIGN KEY ("denuncianteEmpresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

