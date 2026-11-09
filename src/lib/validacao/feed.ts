import { z } from "zod";
import { MAX_TEXTO_COMENTARIO, MAX_TEXTO_POSTAGEM, normalizarTextoLivre } from "@/lib/feed";

const texto = (max: number, rotulo: string) =>
  z.string().transform(normalizarTextoLivre).pipe(z.string().max(max, `${rotulo} aceita até ${max} caracteres.`));

export const textoPostagemSchema = texto(MAX_TEXTO_POSTAGEM, "A postagem");

export const comentarioSchema = z
  .object({
    postagemId: z.string().uuid(),
    texto: texto(MAX_TEXTO_COMENTARIO, "O comentário").pipe(z.string().min(1, "Escreva o comentário.")),
  })
  .strict();

export const idSchema = z.object({ id: z.string().uuid() }).strict();

export const paginaSchema = z.object({ cursor: z.string().max(200).nullable() }).strict();

export const denunciarPostagemSchema = z
  .object({
    postagemId: z.string().uuid(),
    comentarioId: z.string().uuid().nullable(),
    motivo: z.enum(["spam", "conteudo_ofensivo", "fraude", "informacao_falsa", "outro"], "Escolha o motivo."),
    descricao: z.string().trim().min(10, "Descreva o problema (mínimo 10 letras).").max(1000),
  })
  .strict();
