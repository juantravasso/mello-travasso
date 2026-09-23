-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "StatusObraDb" AS ENUM ('em_andamento', 'concluida', 'pausada');

-- CreateEnum
CREATE TYPE "StatusContaDb" AS ENUM ('em_aberto', 'baixada', 'cancelada');

-- CreateEnum
CREATE TYPE "TipoContaDb" AS ENUM ('pagar', 'receber');

-- CreateEnum
CREATE TYPE "StatusFuncionarioDb" AS ENUM ('ativo', 'inativo');

-- CreateTable
CREATE TABLE "Obra" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cliente" TEXT NOT NULL,
    "endereco" TEXT,
    "status" "StatusObraDb" NOT NULL,
    "dataInicio" TEXT NOT NULL,
    "dataFim" TEXT,
    "orcamentoPrevisto" DOUBLE PRECISION,
    "observacoes" TEXT,
    "criadoEm" TEXT NOT NULL,
    "atualizadoEm" TEXT NOT NULL,

    CONSTRAINT "Obra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContaFinanceira" (
    "id" TEXT NOT NULL,
    "tipo" "TipoContaDb" NOT NULL,
    "obraId" TEXT NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,
    "dataLancamento" TEXT NOT NULL,
    "dataVencimento" TEXT NOT NULL,
    "dataBaixa" TEXT,
    "status" "StatusContaDb" NOT NULL DEFAULT 'em_aberto',
    "favorecidoOuCliente" TEXT NOT NULL,
    "fornecedorId" TEXT,
    "descricao" TEXT NOT NULL,
    "categoria" TEXT,
    "formaPagamento" TEXT,
    "observacao" TEXT,
    "comprovanteUrl" TEXT NOT NULL,
    "origemNotaFiscal" BOOLEAN NOT NULL DEFAULT false,
    "notaFiscalId" TEXT,
    "precisaCompletarCadastro" BOOLEAN NOT NULL DEFAULT false,
    "parcelamentoId" TEXT,
    "parcelaNumero" INTEGER,
    "parcelaTotal" INTEGER,
    "motivoCancelamento" TEXT,
    "historico" JSONB NOT NULL DEFAULT '[]',
    "criadoEm" TEXT NOT NULL,
    "atualizadoEm" TEXT NOT NULL,

    CONSTRAINT "ContaFinanceira_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fornecedor" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "documento" TEXT,
    "telefone" TEXT,
    "email" TEXT,
    "cep" TEXT,
    "logradouro" TEXT,
    "numero" TEXT,
    "complemento" TEXT,
    "bairro" TEXT,
    "cidade" TEXT,
    "estado" TEXT,
    "observacao" TEXT,
    "criadoEm" TEXT NOT NULL,
    "atualizadoEm" TEXT NOT NULL,

    CONSTRAINT "Fornecedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemProduto" (
    "id" TEXT NOT NULL,
    "contaFinanceiraId" TEXT NOT NULL,
    "obraId" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "quantidade" DOUBLE PRECISION NOT NULL,
    "unidade" TEXT,
    "valorUnitario" DOUBLE PRECISION NOT NULL,
    "valorTotal" DOUBLE PRECISION NOT NULL,
    "dataCompra" TEXT NOT NULL,
    "fornecedor" TEXT,
    "criadoEm" TEXT NOT NULL,

    CONSTRAINT "ItemProduto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Funcionario" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cargo" TEXT NOT NULL,
    "telefone" TEXT,
    "email" TEXT,
    "cpf" TEXT,
    "dataAdmissao" TEXT NOT NULL,
    "obraId" TEXT,
    "salario" DOUBLE PRECISION,
    "status" "StatusFuncionarioDb" NOT NULL DEFAULT 'ativo',
    "criadoEm" TEXT NOT NULL,
    "atualizadoEm" TEXT NOT NULL,

    CONSTRAINT "Funcionario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoriaPersonalizada" (
    "id" TEXT NOT NULL,
    "tipoConta" "TipoContaDb" NOT NULL,
    "rotulo" TEXT NOT NULL,
    "criadoEm" TEXT NOT NULL,

    CONSTRAINT "CategoriaPersonalizada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormaPagamentoPersonalizada" (
    "id" TEXT NOT NULL,
    "rotulo" TEXT NOT NULL,
    "criadoEm" TEXT NOT NULL,

    CONSTRAINT "FormaPagamentoPersonalizada_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContaFinanceira_obraId_idx" ON "ContaFinanceira"("obraId");

-- CreateIndex
CREATE INDEX "ContaFinanceira_tipo_status_idx" ON "ContaFinanceira"("tipo", "status");

-- CreateIndex
CREATE INDEX "ContaFinanceira_fornecedorId_idx" ON "ContaFinanceira"("fornecedorId");

-- CreateIndex
CREATE INDEX "Fornecedor_nome_idx" ON "Fornecedor"("nome");

-- CreateIndex
CREATE INDEX "Fornecedor_documento_idx" ON "Fornecedor"("documento");

-- CreateIndex
CREATE INDEX "ItemProduto_obraId_idx" ON "ItemProduto"("obraId");

-- CreateIndex
CREATE INDEX "ItemProduto_descricao_idx" ON "ItemProduto"("descricao");

-- CreateIndex
CREATE INDEX "Funcionario_obraId_idx" ON "Funcionario"("obraId");

-- AddForeignKey
ALTER TABLE "ContaFinanceira" ADD CONSTRAINT "ContaFinanceira_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContaFinanceira" ADD CONSTRAINT "ContaFinanceira_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemProduto" ADD CONSTRAINT "ItemProduto_contaFinanceiraId_fkey" FOREIGN KEY ("contaFinanceiraId") REFERENCES "ContaFinanceira"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemProduto" ADD CONSTRAINT "ItemProduto_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Funcionario" ADD CONSTRAINT "Funcionario_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

