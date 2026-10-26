-- Convite para a chamada de configuração: o que cada empresa fez com ele.
-- Só adiciona duas colunas opcionais; nenhum dado existente é alterado.

-- AlterTable
ALTER TABLE "Empresa" ADD COLUMN "chamadaConfiguracaoEstado" TEXT,
ADD COLUMN "chamadaConfiguracaoEm" TEXT;
