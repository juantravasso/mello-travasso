-- Depósito e rateio de notas: cada empresa ganha um Depósito (local de estoque) e uma nota pode ter o valor
-- dividido entre projetos e Depósito. Só cria objetos novos e adiciona colunas com padrão; o único INSERT cria o
-- Depósito de cada empresa existente. Nenhum dado existente é alterado ou apagado.
-- AlterTable
ALTER TABLE "MovimentoEstoque" ADD COLUMN     "transferenciaId" TEXT;

-- AlterTable
ALTER TABLE "Obra" ADD COLUMN     "ehDeposito" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "RateioConta" (
    "id" TEXT NOT NULL,
    "contaFinanceiraId" TEXT NOT NULL,
    "obraId" TEXT NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "RateioConta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RateioConta_obraId_idx" ON "RateioConta"("obraId");

-- CreateIndex
CREATE UNIQUE INDEX "RateioConta_contaFinanceiraId_obraId_key" ON "RateioConta"("contaFinanceiraId", "obraId");

-- CreateIndex
CREATE INDEX "MovimentoEstoque_transferenciaId_idx" ON "MovimentoEstoque"("transferenciaId");

-- AddForeignKey
ALTER TABLE "RateioConta" ADD CONSTRAINT "RateioConta_contaFinanceiraId_fkey" FOREIGN KEY ("contaFinanceiraId") REFERENCES "ContaFinanceira"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RateioConta" ADD CONSTRAINT "RateioConta_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- No máximo um Depósito por empresa
CREATE UNIQUE INDEX "Obra_deposito_unico" ON "Obra"("empresaId") WHERE "ehDeposito" = true;

ALTER TABLE "RateioConta" ADD CONSTRAINT "RateioConta_valor_check" CHECK ("valor" >= 0);

-- O Depósito de cada empresa que já existe (empresas novas ganham o seu no cadastro)
INSERT INTO "Obra" ("id", "empresaId", "nome", "cliente", "status", "dataInicio", "ehDeposito", "criadoEm", "atualizadoEm")
SELECT gen_random_uuid()::text, e."id", 'Depósito', 'Interno', 'em_andamento', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD'), true,
       to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
FROM "Empresa" e
WHERE NOT EXISTS (SELECT 1 FROM "Obra" o WHERE o."empresaId" = e."id" AND o."ehDeposito" = true);
