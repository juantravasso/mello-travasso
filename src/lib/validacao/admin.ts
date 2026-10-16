import { z } from "zod";

const motivo = z.string().trim().min(5, "Descreva o motivo (mínimo 5 letras).").max(500);

export const bloquearSchema = z
  .object({
    alvoId: z.string().uuid(),
    motivo,
  })
  .strict();

export const alvoSchema = z.object({ alvoId: z.string().uuid() }).strict();

export const alterarPlanoSchema = z
  .object({
    empresaId: z.string().uuid(),
    plano: z.enum(["gratuito", "teste", "cortesia", "ativo"]),
    motivo,
  })
  .strict();

export const recursosDoPlanoSchema = z
  .object({
    plano: z.enum(["teste", "cortesia", "ativo", "suspenso", "gratuito"]),
    recursos: z
      .array(z.string().regex(/^[a-z_]{1,40}$/))
      .max(20)
      .transform((lista) => [...new Set(lista)]),
    motivo,
  })
  .strict();

export const buscaAdminSchema = z.string().trim().max(80);
