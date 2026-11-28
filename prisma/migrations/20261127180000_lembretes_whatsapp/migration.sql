-- AlterEnum
ALTER TYPE "TipoLembreteDb" ADD VALUE 'antes';

-- AlterEnum
ALTER TYPE "CanalLembreteDb" ADD VALUE 'whatsapp';

-- AlterTable
ALTER TABLE "VinculoWhatsapp" ADD COLUMN     "lembretesAtivos" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Compromisso" ADD COLUMN     "avisoMinutosAntes" INTEGER,
ADD COLUMN     "lembretesPadrao" BOOLEAN NOT NULL DEFAULT true;

