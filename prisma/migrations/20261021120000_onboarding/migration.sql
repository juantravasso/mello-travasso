-- Onboarding: progresso do tour, checklist oculto e tutoriais vistos de cada usuário. Só cria uma tabela nova, com
-- chave estrangeira para Usuario (apagar o usuário apaga o progresso dele). Nenhum dado existente é alterado.

-- CreateTable
CREATE TABLE "ProgressoOnboarding" (
    "usuarioId" TEXT NOT NULL,
    "tourEstado" TEXT NOT NULL DEFAULT 'nao_iniciado',
    "tourPasso" INTEGER NOT NULL DEFAULT 0,
    "checklistOcultoEm" TEXT,
    "ajudasVistas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "criadoEm" TEXT NOT NULL,
    "atualizadoEm" TEXT NOT NULL,

    CONSTRAINT "ProgressoOnboarding_pkey" PRIMARY KEY ("usuarioId")
);

-- AddForeignKey
ALTER TABLE "ProgressoOnboarding" ADD CONSTRAINT "ProgressoOnboarding_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
