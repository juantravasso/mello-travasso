-- Como a assinatura foi paga: cartão (padrão, tudo que já existe) ou Pix.
ALTER TABLE "AssinaturaComercial" ADD COLUMN "meio" TEXT NOT NULL DEFAULT 'cartao';
