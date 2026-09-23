import { z } from "zod";

const camposFuncionario = {
  nome: z.string().trim().min(1, "Informe o nome").max(160),
  cargo: z.string().trim().min(1, "Informe o cargo").max(160),
  telefone: z.string().trim().max(30).optional(),
  email: z.string().trim().max(180).optional(),
  cpf: z.string().trim().max(20).optional(),
  dataAdmissao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  obraId: z.string().uuid().optional(),
  salario: z.number().nonnegative().optional(),
};

export const novoFuncionarioSchema = z.object(camposFuncionario).strict();
export const atualizarFuncionarioSchema = z.object(camposFuncionario).partial().strict();
export const statusFuncionarioSchema = z.enum(["ativo", "inativo"]);
