-- AlterTable
ALTER TABLE "Empresa" ADD COLUMN     "bloqueadaEm" TEXT,
ADD COLUMN     "bloqueioMotivo" TEXT;

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "bloqueadoPlataformaEm" TEXT,
ADD COLUMN     "bloqueioPlataformaMotivo" TEXT;

