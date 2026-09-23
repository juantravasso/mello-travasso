import { z } from "zod";
import { categoriasPagar } from "@/lib/categorias";

// Valida a saída da IA (Anthropic) antes de ela chegar à UI ou a qualquer
// action de escrita — a IA lê o conteúdo de um documento enviado pelo
// usuário, então o texto dentro da imagem é, na prática, entrada não
// confiável (PRD multiempresa-login-trial.md §7: "a resposta da BrasilAPI é
// tratada como não confiável"; o mesmo vale aqui para a saída do provedor de
// IA). O valor final ainda passa por novaContaSchema ao gravar — isto aqui é
// a primeira barreira, contra estrutura/tamanho inesperados vindos do modelo.
const itemNotaFiscalSchema = z
  .object({
    descricao: z.string().max(500).optional(),
    quantidade: z.number().finite().optional(),
    unidade: z.string().max(50).optional(),
    valorUnitario: z.number().finite().optional(),
    valorTotal: z.number().finite().optional(),
  })
  .strict();

export const dadosExtraidosComprovanteSchema = z
  .object({
    tipoDocumento: z.enum(["comprovante", "nota_fiscal"]),
    valor: z.number().finite().positive().optional(),
    data: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida")
      .optional(),
    favorecido: z.string().max(200).optional(),
    cnpjFavorecido: z.string().max(30).optional(),
    descricao: z.string().max(500).optional(),
    categoriaSugerida: z.enum(categoriasPagar as [string, ...string[]]).optional(),
    itens: z.array(itemNotaFiscalSchema).max(200).optional(),
    confiancaExtracao: z.number().min(0).max(1),
    camposComBaixaConfianca: z.array(z.string().max(100)).max(50),
  })
  .strict();
