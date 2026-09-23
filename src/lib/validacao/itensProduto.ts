import { z } from "zod";

export const novoItemProdutoSchema = z
  .object({
    contaFinanceiraId: z.string().uuid(),
    obraId: z.string().uuid(),
    descricao: z.string().trim().min(1, "Informe a descrição").max(300),
    quantidade: z.number().positive(),
    unidade: z.string().trim().max(20).optional(),
    valorUnitario: z.number().nonnegative(),
    valorTotal: z.number().nonnegative(),
    dataCompra: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
    fornecedor: z.string().trim().max(200).optional(),
  })
  .strict();

export const itensProdutoEmLoteSchema = z.array(novoItemProdutoSchema).min(1).max(200);
