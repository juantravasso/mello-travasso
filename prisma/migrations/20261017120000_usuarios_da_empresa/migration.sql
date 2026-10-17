-- Usuários criados pelo dono da empresa: desativação e validade da senha temporária.
-- Só adiciona colunas opcionais: nenhum dado existente muda e o código anterior continua funcionando.
ALTER TABLE "Usuario" ADD COLUMN "desativadoEm" TEXT;
ALTER TABLE "Usuario" ADD COLUMN "senhaTemporariaExpiraEm" TEXT;
