-- Módulos por usuário: o dono da empresa escolhe o que cada funcionário acessa.
-- Adiciona a coluna (lista vazia por padrão) e dá a todo membro já existente todos os módulos, para não
-- tirar acesso de ninguém: até aqui um membro enxergava tudo. O dono (papel "dono") ignora a coluna.
ALTER TABLE "Usuario" ADD COLUMN "modulos" TEXT[] DEFAULT ARRAY[]::TEXT[];

UPDATE "Usuario"
SET "modulos" = ARRAY['dashboard', 'calendario', 'captura', 'contas_pagar', 'contas_receber', 'projetos', 'estoque', 'funcionarios', 'fornecedores', 'rede']::TEXT[]
WHERE "papel" = 'membro';
