-- Calendário e lembretes: compromissos, compartilhamento, lembretes agendados e entregas.
-- Só cria objetos novos e adiciona colunas com valor padrão: nenhum dado existente muda.

-- CreateEnum
CREATE TYPE "CategoriaCompromissoDb" AS ENUM ('reuniao', 'visita', 'prazo', 'financeiro', 'pessoal', 'outro');

-- CreateEnum
CREATE TYPE "StatusCompromissoDb" AS ENUM ('agendado', 'concluido', 'cancelado');

-- CreateEnum
CREATE TYPE "TipoLembreteDb" AS ENUM ('vespera', 'dia');

-- CreateEnum
CREATE TYPE "StatusLembreteDb" AS ENUM ('pendente', 'processando', 'processado', 'ignorado');

-- CreateEnum
CREATE TYPE "CanalLembreteDb" AS ENUM ('email', 'app');

-- CreateEnum
CREATE TYPE "StatusEntregaDb" AS ENUM ('pendente', 'enviada', 'falhou', 'ignorada');

-- AlterTable
ALTER TABLE "Empresa" ADD COLUMN     "fusoHorario" TEXT NOT NULL DEFAULT 'America/Sao_Paulo';

-- AlterTable
ALTER TABLE "Notificacao" ADD COLUMN     "compromissoId" TEXT,
ADD COLUMN     "titulo" TEXT,
ADD COLUMN     "usuarioId" TEXT;

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "lembretesNoApp" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lembretesPorEmail" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "Compromisso" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "criadoPorId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "categoria" "CategoriaCompromissoDb" NOT NULL DEFAULT 'outro',
    "status" "StatusCompromissoDb" NOT NULL DEFAULT 'agendado',
    "data" TEXT NOT NULL,
    "diaInteiro" BOOLEAN NOT NULL DEFAULT false,
    "horaInicio" TEXT,
    "horaFim" TEXT,
    "fuso" TEXT NOT NULL,
    "inicioEm" TEXT NOT NULL,
    "fimEm" TEXT NOT NULL,
    "criadoEm" TEXT NOT NULL,
    "atualizadoEm" TEXT NOT NULL,

    CONSTRAINT "Compromisso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompromissoParticipante" (
    "compromissoId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "criadoEm" TEXT NOT NULL,

    CONSTRAINT "CompromissoParticipante_pkey" PRIMARY KEY ("compromissoId","usuarioId")
);

-- CreateTable
CREATE TABLE "LembreteCompromisso" (
    "id" TEXT NOT NULL,
    "compromissoId" TEXT NOT NULL,
    "tipo" "TipoLembreteDb" NOT NULL,
    "disparoEm" TEXT NOT NULL,
    "versao" INTEGER NOT NULL DEFAULT 1,
    "status" "StatusLembreteDb" NOT NULL DEFAULT 'pendente',
    "travadoAte" TEXT,
    "processadoEm" TEXT,
    "criadoEm" TEXT NOT NULL,
    "atualizadoEm" TEXT NOT NULL,

    CONSTRAINT "LembreteCompromisso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntregaLembrete" (
    "id" TEXT NOT NULL,
    "lembreteId" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "canal" "CanalLembreteDb" NOT NULL,
    "status" "StatusEntregaDb" NOT NULL DEFAULT 'pendente',
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "proximaTentativaEm" TEXT,
    "travadoAte" TEXT,
    "ultimoErro" TEXT,
    "enviadoEm" TEXT,
    "criadoEm" TEXT NOT NULL,
    "atualizadoEm" TEXT NOT NULL,

    CONSTRAINT "EntregaLembrete_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Compromisso_empresaId_data_idx" ON "Compromisso"("empresaId", "data");

-- CreateIndex
CREATE INDEX "Compromisso_criadoPorId_data_idx" ON "Compromisso"("criadoPorId", "data");

-- CreateIndex
CREATE INDEX "CompromissoParticipante_usuarioId_idx" ON "CompromissoParticipante"("usuarioId");

-- CreateIndex
CREATE INDEX "LembreteCompromisso_status_disparoEm_idx" ON "LembreteCompromisso"("status", "disparoEm");

-- CreateIndex
CREATE UNIQUE INDEX "LembreteCompromisso_compromissoId_tipo_key" ON "LembreteCompromisso"("compromissoId", "tipo");

-- CreateIndex
CREATE INDEX "EntregaLembrete_status_proximaTentativaEm_idx" ON "EntregaLembrete"("status", "proximaTentativaEm");

-- CreateIndex
CREATE UNIQUE INDEX "EntregaLembrete_lembreteId_versao_usuarioId_canal_key" ON "EntregaLembrete"("lembreteId", "versao", "usuarioId", "canal");

-- CreateIndex
CREATE INDEX "Notificacao_usuarioId_lida_criadoEm_idx" ON "Notificacao"("usuarioId", "lida", "criadoEm");

-- CreateIndex
CREATE INDEX "Notificacao_compromissoId_idx" ON "Notificacao"("compromissoId");

-- AddForeignKey
ALTER TABLE "Notificacao" ADD CONSTRAINT "Notificacao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notificacao" ADD CONSTRAINT "Notificacao_compromissoId_fkey" FOREIGN KEY ("compromissoId") REFERENCES "Compromisso"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Compromisso" ADD CONSTRAINT "Compromisso_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Compromisso" ADD CONSTRAINT "Compromisso_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompromissoParticipante" ADD CONSTRAINT "CompromissoParticipante_compromissoId_fkey" FOREIGN KEY ("compromissoId") REFERENCES "Compromisso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompromissoParticipante" ADD CONSTRAINT "CompromissoParticipante_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LembreteCompromisso" ADD CONSTRAINT "LembreteCompromisso_compromissoId_fkey" FOREIGN KEY ("compromissoId") REFERENCES "Compromisso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntregaLembrete" ADD CONSTRAINT "EntregaLembrete_lembreteId_fkey" FOREIGN KEY ("lembreteId") REFERENCES "LembreteCompromisso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntregaLembrete" ADD CONSTRAINT "EntregaLembrete_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Integridade que o Prisma não expressa
ALTER TABLE "Compromisso" ADD CONSTRAINT "Compromisso_horario_check" CHECK (
  ("diaInteiro" = true AND "horaInicio" IS NULL AND "horaFim" IS NULL)
  OR ("diaInteiro" = false AND "horaInicio" IS NOT NULL)
);
ALTER TABLE "Compromisso" ADD CONSTRAINT "Compromisso_periodo_check" CHECK ("fimEm" >= "inicioEm");
ALTER TABLE "EntregaLembrete" ADD CONSTRAINT "EntregaLembrete_tentativas_check" CHECK ("tentativas" >= 0);
