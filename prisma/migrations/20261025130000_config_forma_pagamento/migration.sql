-- Configuração por empresa de cada forma de pagamento: baixa automática e dia de vencimento.
-- Só cria tabela nova; nenhuma tabela existente é alterada.

-- CreateTable
CREATE TABLE "ConfiguracaoFormaPagamento" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "baixaAutomatica" BOOLEAN NOT NULL,
    "diaVencimento" INTEGER,
    "atualizadoEm" TEXT NOT NULL,

    CONSTRAINT "ConfiguracaoFormaPagamento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConfiguracaoFormaPagamento_empresaId_chave_key" ON "ConfiguracaoFormaPagamento"("empresaId", "chave");

-- AddForeignKey
ALTER TABLE "ConfiguracaoFormaPagamento" ADD CONSTRAINT "ConfiguracaoFormaPagamento_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
