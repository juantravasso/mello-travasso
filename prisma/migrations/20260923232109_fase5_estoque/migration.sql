-- CreateEnum
CREATE TYPE "TipoMovimentoEstoqueDb" AS ENUM ('entrada', 'saida', 'ajuste');

-- AlterTable
ALTER TABLE "ItemProduto" ADD COLUMN     "produtoId" TEXT;

-- CreateTable
CREATE TABLE "Produto" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "sku" TEXT,
    "categoria" TEXT,
    "unidade" TEXT,
    "custoMedio" DOUBLE PRECISION,
    "estoqueMinimo" DOUBLE PRECISION,
    "observacao" TEXT,
    "criadoEm" TEXT NOT NULL,
    "atualizadoEm" TEXT NOT NULL,

    CONSTRAINT "Produto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaldoEstoque" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "obraId" TEXT NOT NULL,
    "quantidade" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "atualizadoEm" TEXT NOT NULL,

    CONSTRAINT "SaldoEstoque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimentoEstoque" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "obraId" TEXT NOT NULL,
    "tipo" "TipoMovimentoEstoqueDb" NOT NULL,
    "quantidade" DOUBLE PRECISION NOT NULL,
    "valorUnitario" DOUBLE PRECISION,
    "origem" TEXT NOT NULL,
    "itemProdutoId" TEXT,
    "observacao" TEXT,
    "criadoEm" TEXT NOT NULL,

    CONSTRAINT "MovimentoEstoque_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Produto_empresaId_idx" ON "Produto"("empresaId");

-- CreateIndex
CREATE INDEX "Produto_nome_idx" ON "Produto"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Produto_empresaId_sku_key" ON "Produto"("empresaId", "sku");

-- CreateIndex
CREATE INDEX "SaldoEstoque_empresaId_idx" ON "SaldoEstoque"("empresaId");

-- CreateIndex
CREATE INDEX "SaldoEstoque_obraId_idx" ON "SaldoEstoque"("obraId");

-- CreateIndex
CREATE UNIQUE INDEX "SaldoEstoque_produtoId_obraId_key" ON "SaldoEstoque"("produtoId", "obraId");

-- CreateIndex
CREATE INDEX "MovimentoEstoque_empresaId_idx" ON "MovimentoEstoque"("empresaId");

-- CreateIndex
CREATE INDEX "MovimentoEstoque_produtoId_idx" ON "MovimentoEstoque"("produtoId");

-- CreateIndex
CREATE INDEX "MovimentoEstoque_obraId_idx" ON "MovimentoEstoque"("obraId");

-- AddForeignKey
ALTER TABLE "ItemProduto" ADD CONSTRAINT "ItemProduto_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Produto" ADD CONSTRAINT "Produto_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaldoEstoque" ADD CONSTRAINT "SaldoEstoque_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaldoEstoque" ADD CONSTRAINT "SaldoEstoque_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaldoEstoque" ADD CONSTRAINT "SaldoEstoque_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentoEstoque" ADD CONSTRAINT "MovimentoEstoque_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentoEstoque" ADD CONSTRAINT "MovimentoEstoque_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentoEstoque" ADD CONSTRAINT "MovimentoEstoque_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentoEstoque" ADD CONSTRAINT "MovimentoEstoque_itemProdutoId_fkey" FOREIGN KEY ("itemProdutoId") REFERENCES "ItemProduto"("id") ON DELETE SET NULL ON UPDATE CASCADE;
