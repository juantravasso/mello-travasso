-- As duas categorias de pró-labore com nome de pessoa viram uma só ("Retirada pró-labore").
-- Só reescreve o texto da categoria das contas já lançadas; nenhuma conta é apagada.
UPDATE "ContaFinanceira" SET "categoria" = 'pro_labore' WHERE "categoria" IN ('pro_labore_marcio', 'pro_labore_anderson');
