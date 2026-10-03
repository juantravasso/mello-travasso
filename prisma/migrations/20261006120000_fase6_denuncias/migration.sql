-- CreateEnum
CREATE TYPE "TipoDenunciaDb" AS ENUM ('fraude', 'avaliacao_falsa', 'nunca_trabalhou', 'conteudo_ofensivo', 'spam', 'informacao_falsa', 'conflito_interesse', 'outro');

-- CreateEnum
CREATE TYPE "StatusDenunciaDb" AS ENUM ('aberta', 'em_analise', 'aguardando_informacoes', 'resolvida', 'rejeitada');

-- CreateEnum
CREATE TYPE "DecisaoDenunciaDb" AS ENUM ('mantida', 'avaliacao_ocultada', 'avaliacao_removida', 'perfil_suspenso');

-- CreateTable
CREATE TABLE "Denuncia" (
    "id" TEXT NOT NULL,
    "denuncianteEmpresaId" TEXT NOT NULL,
    "denuncianteUsuarioId" TEXT NOT NULL,
    "avaliacaoId" TEXT,
    "perfilId" TEXT,
    "motivo" "TipoDenunciaDb" NOT NULL,
    "descricao" TEXT NOT NULL,
    "complemento" TEXT,
    "status" "StatusDenunciaDb" NOT NULL DEFAULT 'aberta',
    "adminResponsavelId" TEXT,
    "decisao" "DecisaoDenunciaDb",
    "observacaoAdmin" TEXT,
    "mensagemAoDenunciante" TEXT,
    "criadoEm" TEXT NOT NULL,
    "atualizadoEm" TEXT NOT NULL,
    "resolvidaEm" TEXT,

    CONSTRAINT "Denuncia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Denuncia_status_criadoEm_idx" ON "Denuncia"("status", "criadoEm");

-- CreateIndex
CREATE INDEX "Denuncia_avaliacaoId_idx" ON "Denuncia"("avaliacaoId");

-- CreateIndex
CREATE INDEX "Denuncia_perfilId_idx" ON "Denuncia"("perfilId");

-- CreateIndex
CREATE UNIQUE INDEX "Denuncia_denuncianteEmpresaId_avaliacaoId_key" ON "Denuncia"("denuncianteEmpresaId", "avaliacaoId");

-- CreateIndex
CREATE UNIQUE INDEX "Denuncia_denuncianteEmpresaId_perfilId_key" ON "Denuncia"("denuncianteEmpresaId", "perfilId");

-- AddForeignKey
ALTER TABLE "Denuncia" ADD CONSTRAINT "Denuncia_denuncianteEmpresaId_fkey" FOREIGN KEY ("denuncianteEmpresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Denuncia" ADD CONSTRAINT "Denuncia_avaliacaoId_fkey" FOREIGN KEY ("avaliacaoId") REFERENCES "Avaliacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Denuncia" ADD CONSTRAINT "Denuncia_perfilId_fkey" FOREIGN KEY ("perfilId") REFERENCES "PerfilPublico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Exatamente um alvo por denúncia: uma avaliação OU um perfil.
ALTER TABLE "Denuncia" ADD CONSTRAINT "Denuncia_um_alvo" CHECK (("avaliacaoId" IS NOT NULL) <> ("perfilId" IS NOT NULL));
