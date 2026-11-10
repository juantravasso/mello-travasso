import { z } from "zod";

const vazioParaUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

export const criarConviteFuncionarioSchema = z
  .object({
    nomeSugerido: z.preprocess(vazioParaUndefined, z.string().trim().max(160).optional()),
    cargoSugerido: z.preprocess(vazioParaUndefined, z.string().trim().max(160).optional()),
  })
  .strict();

/** O que a pessoa preenche na página pública. Estrito: nada além disso entra (nem salário, nem projeto). */
export const cadastroPublicoFuncionarioSchema = z
  .object({
    nome: z.string().trim().min(2, "Informe o seu nome completo.").max(160),
    cargo: z.string().trim().min(2, "Informe o seu cargo ou função.").max(160),
    telefone: z.preprocess(vazioParaUndefined, z.string().trim().max(30).optional()),
    email: z.preprocess(vazioParaUndefined, z.string().trim().toLowerCase().email("E-mail inválido.").max(180).optional()),
    cpf: z.preprocess(
      (v) => (typeof v === "string" ? v.replace(/\D/g, "") || undefined : v),
      z.string().length(11, "O CPF tem 11 números.").optional(),
    ),
    // O aviso de privacidade precisa ser lido e aceito: os dados vão para a empresa que enviou o link.
    ciente: z.literal(true, { error: "Confirme que está de acordo para enviar." }),
  })
  .strict();

export const idConviteSchema = z.string().uuid();
