import { z } from "zod";
import { CHAVES_MODULO } from "@/lib/auth/modulos";
import { emailSchema } from "./auth";

// Os módulos chegam como lista de chaves conhecidas; repetição é descartada e lista vazia recusada.
const modulos = z
  .array(z.enum(CHAVES_MODULO as [string, ...string[]]), { message: "Módulo inválido" })
  .min(1, "Escolha ao menos um módulo para esta pessoa")
  .max(CHAVES_MODULO.length, "Módulos demais")
  .transform((lista) => [...new Set(lista)] as (typeof CHAVES_MODULO)[number][]);

export const criarUsuarioSchema = z
  .object({
    // O nome aparece no histórico das contas e do estoque ("quem lançou"): precisa identificar a pessoa.
    nome: z.string().trim().min(3, "Informe o nome e o sobrenome da pessoa").max(120, "Nome muito longo"),
    email: emailSchema,
    modulos,
  })
  .strict();

export const alvoUsuarioSchema = z.object({ usuarioId: z.uuid("Usuário não encontrado.") }).strict();

export const alterarModulosSchema = z.object({ usuarioId: z.uuid("Usuário não encontrado."), modulos }).strict();
