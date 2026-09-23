import { z } from "zod";

const parcelaSchema = z
  .object({
    numero: z.number().int().positive(),
    totalParcelas: z.number().int().positive(),
  })
  .strict();

// Guarda o comprovante como data URL base64 (ver src/lib/imagem.ts). Mesmo
// teto usado em extract-recibo/route.ts (8 MB de arquivo + ~33% de inchaço
// do base64 + folga para o prefixo "data:image/...;base64,").
const TAMANHO_MAX_COMPROVANTE_CHARS = 12 * 1024 * 1024;

const camposConta = {
  tipo: z.enum(["pagar", "receber"]),
  obraId: z.string().uuid(),
  valor: z.number().positive(),
  dataLancamento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  dataVencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  favorecidoOuCliente: z.string().trim().min(1, "Informe o favorecido/cliente").max(200),
  fornecedorId: z.string().uuid().optional(),
  descricao: z.string().trim().min(1, "Informe a descrição").max(500),
  categoria: z.string().trim().max(100).optional(),
  formaPagamento: z.string().trim().max(100).optional(),
  observacao: z.string().trim().max(2000).optional(),
  comprovanteUrl: z.string().max(TAMANHO_MAX_COMPROVANTE_CHARS),
  origemNotaFiscal: z.boolean(),
  notaFiscalId: z.string().max(200).optional(),
  precisaCompletarCadastro: z.boolean(),
  parcelamentoId: z.string().max(100).optional(),
  parcela: parcelaSchema.optional(),
};

export const novaContaSchema = z.object(camposConta).strict();
export const atualizarContaSchema = z.object(camposConta).partial().strict();

export const baixarContaSchema = z
  .object({
    contaId: z.string().uuid(),
    dataBaixa: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  })
  .strict();

export const cancelarContaSchema = z
  .object({
    contaId: z.string().uuid(),
    motivo: z.string().trim().max(500).optional(),
  })
  .strict();
