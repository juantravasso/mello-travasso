import { z } from "zod";

// .strict() é a defesa central aqui: rejeita qualquer chave a mais no objeto
// (ex.: um "empresaId" forjado num POST direto à Server Action, contornando
// o formulário) — sem isso, o spread de `input` no `data` do Prisma passaria
// o campo adiante (ver achado do security-reviewer na Fase 2).
const camposObra = {
  nome: z.string().trim().min(1, "Informe o nome da obra").max(160),
  cliente: z.string().trim().min(1, "Informe o cliente").max(160),
  endereco: z.string().trim().max(300).optional(),
  status: z.enum(["em_andamento", "concluida", "pausada"]),
  dataInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  dataFim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida").optional(),
  orcamentoPrevisto: z.number().nonnegative().optional(),
  observacoes: z.string().trim().max(2000).optional(),
};

export const novaObraSchema = z.object(camposObra).strict();
export const atualizarObraSchema = z.object(camposObra).partial().strict();
