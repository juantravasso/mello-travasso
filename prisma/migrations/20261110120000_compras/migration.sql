-- CreateEnum
CREATE TYPE "StatusCompraDb" AS ENUM ('rascunho', 'efetivada', 'cancelada');

-- CreateTable
CREATE TABLE "Compra" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "status" "StatusCompraDb" NOT NULL DEFAULT 'rascunho',
    "origem" TEXT NOT NULL,
    "fornecedorId" TEXT,
    "fornecedorNome" TEXT NOT NULL,
    "numeroNf" TEXT,
    "serie" TEXT,
    "chaveAcesso" TEXT,
    "dataEmissao" TEXT,
    "dataCompra" TEXT NOT NULL,
    "obraId" TEXT NOT NULL,
    "categoria" TEXT,
    "formaPagamento" TEXT,
    "frete" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "seguro" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "outrasDespesas" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "descontoTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "valorProdutos" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "valorTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "parcelas" JSONB NOT NULL DEFAULT '[]',
    "observacao" TEXT,
    "comprovanteUrl" TEXT NOT NULL DEFAULT '',
    "contaFinanceiraId" TEXT,
    "motivoCancelamento" TEXT,
    "criadoPor" TEXT NOT NULL,
    "criadoEm" TEXT NOT NULL,
    "atualizadoEm" TEXT NOT NULL,

    CONSTRAINT "Compra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompraItem" (
    "id" TEXT NOT NULL,
    "compraId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "descricao" TEXT NOT NULL,
    "codigoFornecedor" TEXT,
    "ncm" TEXT,
    "unidade" TEXT,
    "quantidade" DOUBLE PRECISION NOT NULL,
    "valorUnitario" DOUBLE PRECISION NOT NULL,
    "desconto" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "valorTotal" DOUBLE PRECISION NOT NULL,
    "obraId" TEXT NOT NULL,
    "produtoId" TEXT,

    CONSTRAINT "CompraItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VinculoProduto" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "fornecedorChave" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "atualizadoEm" TEXT NOT NULL,

    CONSTRAINT "VinculoProduto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Compra_empresaId_status_idx" ON "Compra"("empresaId", "status");

-- CreateIndex
CREATE INDEX "Compra_fornecedorId_idx" ON "Compra"("fornecedorId");

-- CreateIndex
CREATE UNIQUE INDEX "Compra_empresaId_numero_key" ON "Compra"("empresaId", "numero");

-- CreateIndex
CREATE INDEX "CompraItem_compraId_idx" ON "CompraItem"("compraId");

-- CreateIndex
CREATE INDEX "CompraItem_produtoId_idx" ON "CompraItem"("produtoId");

-- CreateIndex
CREATE INDEX "VinculoProduto_produtoId_idx" ON "VinculoProduto"("produtoId");

-- CreateIndex
CREATE UNIQUE INDEX "VinculoProduto_empresaId_fornecedorChave_chave_key" ON "VinculoProduto"("empresaId", "fornecedorChave", "chave");

-- AddForeignKey
ALTER TABLE "Compra" ADD CONSTRAINT "Compra_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Compra" ADD CONSTRAINT "Compra_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Compra" ADD CONSTRAINT "Compra_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompraItem" ADD CONSTRAINT "CompraItem_compraId_fkey" FOREIGN KEY ("compraId") REFERENCES "Compra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompraItem" ADD CONSTRAINT "CompraItem_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompraItem" ADD CONSTRAINT "CompraItem_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VinculoProduto" ADD CONSTRAINT "VinculoProduto_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VinculoProduto" ADD CONSTRAINT "VinculoProduto_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

