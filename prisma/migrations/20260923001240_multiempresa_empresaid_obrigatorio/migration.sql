/*
  Warnings:

  - Made the column `empresaId` on table `CategoriaPersonalizada` required. This step will fail if there are existing NULL values in that column.
  - Made the column `empresaId` on table `ContaFinanceira` required. This step will fail if there are existing NULL values in that column.
  - Made the column `empresaId` on table `FormaPagamentoPersonalizada` required. This step will fail if there are existing NULL values in that column.
  - Made the column `empresaId` on table `Fornecedor` required. This step will fail if there are existing NULL values in that column.
  - Made the column `empresaId` on table `Funcionario` required. This step will fail if there are existing NULL values in that column.
  - Made the column `empresaId` on table `ItemProduto` required. This step will fail if there are existing NULL values in that column.
  - Made the column `empresaId` on table `Obra` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "CategoriaPersonalizada" DROP CONSTRAINT "CategoriaPersonalizada_empresaId_fkey";

-- DropForeignKey
ALTER TABLE "ContaFinanceira" DROP CONSTRAINT "ContaFinanceira_empresaId_fkey";

-- DropForeignKey
ALTER TABLE "FormaPagamentoPersonalizada" DROP CONSTRAINT "FormaPagamentoPersonalizada_empresaId_fkey";

-- DropForeignKey
ALTER TABLE "Fornecedor" DROP CONSTRAINT "Fornecedor_empresaId_fkey";

-- DropForeignKey
ALTER TABLE "Funcionario" DROP CONSTRAINT "Funcionario_empresaId_fkey";

-- DropForeignKey
ALTER TABLE "ItemProduto" DROP CONSTRAINT "ItemProduto_empresaId_fkey";

-- DropForeignKey
ALTER TABLE "Obra" DROP CONSTRAINT "Obra_empresaId_fkey";

-- AlterTable
ALTER TABLE "CategoriaPersonalizada" ALTER COLUMN "empresaId" SET NOT NULL;

-- AlterTable
ALTER TABLE "ContaFinanceira" ALTER COLUMN "empresaId" SET NOT NULL;

-- AlterTable
ALTER TABLE "FormaPagamentoPersonalizada" ALTER COLUMN "empresaId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Fornecedor" ALTER COLUMN "empresaId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Funcionario" ALTER COLUMN "empresaId" SET NOT NULL;

-- AlterTable
ALTER TABLE "ItemProduto" ALTER COLUMN "empresaId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Obra" ALTER COLUMN "empresaId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Obra" ADD CONSTRAINT "Obra_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContaFinanceira" ADD CONSTRAINT "ContaFinanceira_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fornecedor" ADD CONSTRAINT "Fornecedor_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemProduto" ADD CONSTRAINT "ItemProduto_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Funcionario" ADD CONSTRAINT "Funcionario_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoriaPersonalizada" ADD CONSTRAINT "CategoriaPersonalizada_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormaPagamentoPersonalizada" ADD CONSTRAINT "FormaPagamentoPersonalizada_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
