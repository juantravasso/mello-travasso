-- AlterTable
ALTER TABLE "Empresa" ADD COLUMN     "indicadaPorConvite" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ConviteFuncionario" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "nomeSugerido" TEXT,
    "cargoSugerido" TEXT,
    "criadoPorNome" TEXT NOT NULL,
    "expiraEm" TEXT NOT NULL,
    "dados" JSONB,
    "preenchidoEm" TEXT,
    "decisao" TEXT,
    "decididoEm" TEXT,
    "funcionarioId" TEXT,
    "criadoEm" TEXT NOT NULL,

    CONSTRAINT "ConviteFuncionario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConviteFuncionario_tokenHash_key" ON "ConviteFuncionario"("tokenHash");

-- CreateIndex
CREATE INDEX "ConviteFuncionario_empresaId_decisao_idx" ON "ConviteFuncionario"("empresaId", "decisao");

-- AddForeignKey
ALTER TABLE "ConviteFuncionario" ADD CONSTRAINT "ConviteFuncionario_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

