import { z } from "zod";

/** Tamanho mínimo da senha. A tela, a validação do servidor e os textos de ajuda usam este mesmo número. */
export const TAMANHO_MINIMO_SENHA = 8;
export const TAMANHO_MAXIMO_SENHA = 128;

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Informe o e-mail")
  .max(180, "E-mail muito longo")
  .email("Esse e-mail não parece válido. Confira se tem o @ e o final, como nome@empresa.com.br");

export const senhaSchema = z
  .string()
  .min(TAMANHO_MINIMO_SENHA, `A senha precisa ter pelo menos ${TAMANHO_MINIMO_SENHA} caracteres`)
  .max(TAMANHO_MAXIMO_SENHA, `A senha pode ter no máximo ${TAMANHO_MAXIMO_SENHA} caracteres`);

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
