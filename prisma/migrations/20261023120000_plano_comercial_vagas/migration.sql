-- Vagas limitadas, parcelamento e condição no catálogo comercial, e o plano comercial contratado por empresa.
-- Só adiciona colunas opcionais (nulas) em tabelas existentes; nenhum dado é alterado.

-- AlterTable
ALTER TABLE "PlanoComercial" ADD COLUMN "vagasTotal" INTEGER,
ADD COLUMN "parcelasSemJuros" INTEGER,
ADD COLUMN "condicao" TEXT;

-- AlterTable
ALTER TABLE "Empresa" ADD COLUMN "planoComercialChave" TEXT;
