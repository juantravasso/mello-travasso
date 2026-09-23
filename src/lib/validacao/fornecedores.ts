import { z } from "zod";

const camposFornecedor = {
  nome: z.string().trim().min(1, "Informe o nome").max(160),
  documento: z.string().trim().max(20).optional(),
  telefone: z.string().trim().max(30).optional(),
  email: z.string().trim().max(180).optional(),
  cep: z.string().trim().max(10).optional(),
  logradouro: z.string().trim().max(200).optional(),
  numero: z.string().trim().max(20).optional(),
  complemento: z.string().trim().max(100).optional(),
  bairro: z.string().trim().max(100).optional(),
  cidade: z.string().trim().max(100).optional(),
  estado: z.string().trim().max(2).optional(),
  observacao: z.string().trim().max(2000).optional(),
};

export const novoFornecedorSchema = z.object(camposFornecedor).strict();
export const atualizarFornecedorSchema = z.object(camposFornecedor).partial().strict();
