-- Catálogo comercial de planos para a página de planos e as ofertas. Só cria uma tabela nova e vazia; nenhum dado
-- existente é alterado e nenhum plano é publicado por padrão.

-- CreateTable
CREATE TABLE "PlanoComercial" (
    "id" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "precoMensalCentavos" INTEGER,
    "precoAnualCentavos" INTEGER,
    "beneficios" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "destaque" BOOLEAN NOT NULL DEFAULT false,
    "publicado" BOOLEAN NOT NULL DEFAULT false,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "criadoEm" TEXT NOT NULL,
    "atualizadoEm" TEXT NOT NULL,

    CONSTRAINT "PlanoComercial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlanoComercial_chave_key" ON "PlanoComercial"("chave");
