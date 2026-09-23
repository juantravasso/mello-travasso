/*
  Warnings:

  - Made the column `aceiteTermosEm` on table `Empresa` required. This step will fail if there are existing NULL values in that column.
  - Made the column `aceiteTermosVersao` on table `Empresa` required. This step will fail if there are existing NULL values in that column.
  - Made the column `plano` on table `Empresa` required. This step will fail if there are existing NULL values in that column.
  - Made the column `tipoPessoa` on table `Empresa` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Empresa" ALTER COLUMN "aceiteTermosEm" SET NOT NULL,
ALTER COLUMN "aceiteTermosVersao" SET NOT NULL,
ALTER COLUMN "plano" SET NOT NULL,
ALTER COLUMN "tipoPessoa" SET NOT NULL;
