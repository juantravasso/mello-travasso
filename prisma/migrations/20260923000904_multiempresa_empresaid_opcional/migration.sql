-- AlterTable
ALTER TABLE "CategoriaPersonalizada" ADD COLUMN     "empresaId" TEXT;

-- AlterTable
ALTER TABLE "ContaFinanceira" ADD COLUMN     "empresaId" TEXT;

-- AlterTable
ALTER TABLE "FormaPagamentoPersonalizada" ADD COLUMN     "empresaId" TEXT;

-- AlterTable
ALTER TABLE "Fornecedor" ADD COLUMN     "empresaId" TEXT;

-- AlterTable
ALTER TABLE "Funcionario" ADD COLUMN     "empresaId" TEXT;

-- AlterTable
ALTER TABLE "ItemProduto" ADD COLUMN     "empresaId" TEXT;

-- AlterTable
ALTER TABLE "Obra" ADD COLUMN     "empresaId" TEXT;

-- CreateIndex
CREATE INDEX "CategoriaPersonalizada_empresaId_idx" ON "CategoriaPersonalizada"("empresaId");

-- CreateIndex
CREATE INDEX "ContaFinanceira_empresaId_idx" ON "ContaFinanceira"("empresaId");

-- CreateIndex
CREATE INDEX "FormaPagamentoPersonalizada_empresaId_idx" ON "FormaPagamentoPersonalizada"("empresaId");

-- CreateIndex
CREATE INDEX "Fornecedor_empresaId_idx" ON "Fornecedor"("empresaId");

-- CreateIndex
CREATE INDEX "Funcionario_empresaId_idx" ON "Funcionario"("empresaId");

-- CreateIndex
CREATE INDEX "ItemProduto_empresaId_idx" ON "ItemProduto"("empresaId");

-- CreateIndex
CREATE INDEX "Obra_empresaId_idx" ON "Obra"("empresaId");

-- AddForeignKey
ALTER TABLE "Obra" ADD CONSTRAINT "Obra_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContaFinanceira" ADD CONSTRAINT "ContaFinanceira_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fornecedor" ADD CONSTRAINT "Fornecedor_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemProduto" ADD CONSTRAINT "ItemProduto_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Funcionario" ADD CONSTRAINT "Funcionario_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoriaPersonalizada" ADD CONSTRAINT "CategoriaPersonalizada_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormaPagamentoPersonalizada" ADD CONSTRAINT "FormaPagamentoPersonalizada_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE SET NULL ON UPDATE CASCADE;
