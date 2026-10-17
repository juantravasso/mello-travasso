import { z } from "zod";

const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida");

// Mesmo teto de contas.ts para o comprovante em data URL.
const TAMANHO_MAX_COMPROVANTE_CHARS = 12 * 1024 * 1024;

const itemSchema = z
  .object({
    descricao: z.string().trim().min(1, "Informe a descrição do item").max(300),
    quantidade: z.number().positive("A quantidade do item precisa ser maior que zero").max(1_000_000_000),
    unidade: z.string().trim().max(20).optional(),
    valorUnitario: z.number().nonnegative().max(1_000_000_000),
    valorTotal: z.number().nonnegative().max(1_000_000_000),
    obraId: z.string().uuid(),
  })
  .strict();

const parcelaSchema = z.object({ valor: z.number().positive().max(1_000_000_000), dataVencimento: data }).strict();

export const capturaSchema = z
  .object({
    tipoDocumento: z.enum(["comprovante", "nota_fiscal"]),
    obraId: z.string().uuid(),
    valor: z.number().positive("Informe o valor").max(1_000_000_000),
    data,
    favorecido: z.string().trim().min(1, "Informe o fornecedor").max(200),
    fornecedorId: z.string().uuid().optional(),
    descricao: z.string().trim().min(1, "Informe a descrição").max(500),
    categoria: z.string().trim().max(100).optional(),
    formaPagamento: z.string().trim().max(100).optional(),
    observacao: z.string().trim().max(2000).optional(),
    comprovanteUrl: z.string().max(TAMANHO_MAX_COMPROVANTE_CHARS),
    itens: z.array(itemSchema).max(200),
    parcelas: z.array(parcelaSchema).max(60).optional(),
  })
  .strict();
