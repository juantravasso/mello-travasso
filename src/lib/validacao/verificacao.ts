import { z } from "zod";

const observacao = z.string().trim().max(500).optional();

export const criarSolicitacaoSchema = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("empresa_verificada"), observacao }).strict(),
  z
    .object({ tipo: z.literal("reivindicacao_perfil"), perfilSlug: z.string().regex(/^[a-z0-9-]{1,80}$/), observacao })
    .strict(),
  z.object({ tipo: z.literal("relacao_comprovada"), avaliacaoId: z.string().uuid(), observacao }).strict(),
]);

export const idSchema = z.string().uuid();
