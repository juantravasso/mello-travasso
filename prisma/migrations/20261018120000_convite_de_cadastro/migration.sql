-- Convite de cadastro: cada empresa ganha um link para convidar outras a criar a própria conta.
-- Só adiciona duas colunas opcionais (nulas nas empresas existentes), dois índices e uma chave estrangeira com
-- ON DELETE SET NULL. Nenhum dado existente é alterado ou apagado.
-- AlterTable
ALTER TABLE "Empresa" ADD COLUMN     "codigoConvite" TEXT,
ADD COLUMN     "convidadaPorId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Empresa_codigoConvite_key" ON "Empresa"("codigoConvite");

-- CreateIndex
CREATE INDEX "Empresa_convidadaPorId_idx" ON "Empresa"("convidadaPorId");

-- AddForeignKey
ALTER TABLE "Empresa" ADD CONSTRAINT "Empresa_convidadaPorId_fkey" FOREIGN KEY ("convidadaPorId") REFERENCES "Empresa"("id") ON DELETE SET NULL ON UPDATE CASCADE;
