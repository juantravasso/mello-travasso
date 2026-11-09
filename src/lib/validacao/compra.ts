import { z } from "zod";

const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida");
const dinheiro = z.number().nonnegative().max(1_000_000_000);
const MAX_COMPROVANTE_CHARS = 12 * 1024 * 1024;

const itemSchema = z
  .object({
    id: z.string().uuid().optional(),
    descricao: z.string().trim().min(1, "Informe a descrição do item").max(300),
    codigoFornecedor: z.string().trim().max(60).optional(),
    ncm: z.string().trim().max(12).optional(),
    unidade: z.string().trim().max(20).optional(),
    quantidade: z.number().positive("A quantidade do item precisa ser maior que zero").max(1_000_000_000),
    valorUnitario: dinheiro,
    desconto: dinheiro,
    // O servidor recalcula; vem na entrada só para a tela não precisar de outro tipo.
    valorTotal: dinheiro,
    obraId: z.string().uuid(),
    produtoId: z.string().uuid().optional(),
  })
  .strict();

const parcelaSchema = z.object({ valor: z.number().positive().max(1_000_000_000), dataVencimento: data }).strict();

export const compraSchema = z
  .object({
    origem: z.enum(["foto", "manual"]),
    fornecedorId: z.string().uuid().optional(),
    fornecedorNome: z.string().trim().min(1, "Informe o fornecedor").max(200),
    numeroNf: z.string().trim().max(30).optional(),
    serie: z.string().trim().max(10).optional(),
    chaveAcesso: z
      .string()
      .trim()
      .regex(/^\d{44}$/, "A chave de acesso tem 44 números")
      .optional(),
    dataEmissao: data.optional(),
    dataCompra: data,
    obraId: z.string().uuid(),
    categoria: z.string().trim().max(100).optional(),
    formaPagamento: z.string().trim().max(100).optional(),
    frete: dinheiro,
    seguro: dinheiro,
    outrasDespesas: dinheiro,
    parcelas: z.array(parcelaSchema).max(60).optional(),
    observacao: z.string().trim().max(2000).optional(),
    comprovanteUrl: z.string().max(MAX_COMPROVANTE_CHARS),
    itens: z.array(itemSchema).min(1, "Adicione ao menos um item").max(200),
  })
  .strict();

export const idCompraSchema = z.string().uuid();

export const cancelarCompraSchema = z
  .object({ id: z.string().uuid(), motivo: z.string().trim().min(3, "Explique o motivo (mínimo 3 letras).").max(300) })
  .strict();

export const filtrosCompraSchema = z
  .object({
    busca: z.string().trim().max(80).optional(),
    de: data.optional(),
    ate: data.optional(),
    status: z.enum(["rascunho", "efetivada", "cancelada"]).optional(),
  })
  .strict();

export const sugestaoSchema = z
  .object({
    fornecedorId: z.string().uuid().optional(),
    fornecedorNome: z.string().trim().max(200).optional(),
    itens: z
      .array(z.object({ descricao: z.string().trim().max(300), codigoFornecedor: z.string().trim().max(60).optional() }).strict())
      .max(200),
  })
  .strict();
