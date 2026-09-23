import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Informe o e-mail")
  .max(180, "E-mail muito longo")
  .email("E-mail inválido");

export const senhaSchema = z
  .string()
  .min(10, "A senha precisa ter pelo menos 10 caracteres")
  .max(128, "A senha pode ter no máximo 128 caracteres");

export const entrarSchema = z
  .object({
    email: emailSchema,
    senha: z.string().min(1, "Informe a senha").max(128),
  })
  .strict();

export const trocarSenhaSchema = z
  .object({
    senhaAtual: z.string().min(1, "Informe a senha atual").max(128),
    senhaNova: senhaSchema,
  })
  .strict();
