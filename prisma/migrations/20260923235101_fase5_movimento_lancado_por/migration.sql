/*
  Warnings:

  - Added the required column `lancadoPor` to the `MovimentoEstoque` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "MovimentoEstoque" ADD COLUMN     "lancadoPor" TEXT NOT NULL;
