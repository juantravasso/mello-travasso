-- Cobrança real dos planos comerciais via Mercado Pago (mensal recorrente + anual parcelado).
-- Só cria tabela nova; nenhuma tabela existente é alterada.

-- CreateTable
CREATE TABLE "AssinaturaComercial" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "planoChave" TEXT NOT NULL,
    "ciclo" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "referenciaExterna" TEXT,
    "parcelas" INTEGER,
    "valorCentavos" INTEGER NOT NULL,
    "reservaExpiraEm" TEXT,
    "proximaCobrancaEm" TEXT,
    "criadoEm" TEXT NOT NULL,
    "atualizadoEm" TEXT NOT NULL,

    CONSTRAINT "AssinaturaComercial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AssinaturaComercial_referenciaExterna_key" ON "AssinaturaComercial"("referenciaExterna");

-- CreateIndex
CREATE INDEX "AssinaturaComercial_empresaId_idx" ON "AssinaturaComercial"("empresaId");

-- CreateIndex
CREATE INDEX "AssinaturaComercial_planoChave_status_idx" ON "AssinaturaComercial"("planoChave", "status");

-- AddForeignKey
ALTER TABLE "AssinaturaComercial" ADD CONSTRAINT "AssinaturaComercial_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssinaturaComercial" ADD CONSTRAINT "AssinaturaComercial_planoChave_fkey" FOREIGN KEY ("planoChave") REFERENCES "PlanoComercial"("chave") ON DELETE RESTRICT ON UPDATE CASCADE;
