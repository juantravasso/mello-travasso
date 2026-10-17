import { z } from "zod";
import { emailSchema } from "./auth";

export const criarUsuarioSchema = z
  .object({
    // O nome aparece no histórico das contas e do estoque ("quem lançou"): precisa identificar a pessoa.
    nome: z.string().trim().min(3, "Informe o nome e o sobrenome da pessoa").max(120, "Nome muito longo"),
    email: emailSchema,
  })
  .strict();

export const alvoUsuarioSchema = z.object({ usuarioId: z.uuid("Usuário não encontrado.") }).strict();
