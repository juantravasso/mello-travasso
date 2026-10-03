import { z } from "zod";
import { SIGLAS_UF } from "@/lib/rede/ufs";
import { normalizarInstagram, normalizarSite, normalizarTelefone } from "@/lib/rede/texto";

const vazioParaUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

const textoOpcional = (max: number) => z.preprocess(vazioParaUndefined, z.string().trim().max(max).optional());

const telefoneOpcional = z.preprocess(
  vazioParaUndefined,
  z
    .string()
    .trim()
    .max(30)
    .transform((v, ctx) => {
      const digitos = normalizarTelefone(v);
      if (!digitos) ctx.addIssue({ code: "custom", message: "Telefone inválido — use DDD + número." });
      return digitos ?? "";
    })
    .optional(),
);

export const salvarPerfilSchema = z
  .object({
    nome: z.string().trim().min(2, "Informe o nome do perfil.").max(120),
    nomeFantasia: textoOpcional(120),
    descricao: textoOpcional(2000),
    estado: z.preprocess(vazioParaUndefined, z.enum(SIGLAS_UF, "UF inválida.").optional()),
    cidade: textoOpcional(100),
    regiao: textoOpcional(100),
    areasAtendimento: z
      .array(z.string().trim().min(1).max(80))
      .max(20, "No máximo 20 áreas de atendimento.")
      .transform((lista) => [...new Set(lista)]),
    telefone: telefoneOpcional,
    telefonePublico: z.boolean(),
    whatsapp: telefoneOpcional,
    whatsappPublico: z.boolean(),
    instagram: z.preprocess(
      vazioParaUndefined,
      z
        .string()
        .trim()
        .max(120)
        .transform((v, ctx) => {
          const usuario = normalizarInstagram(v);
          if (!usuario) ctx.addIssue({ code: "custom", message: "Instagram inválido — informe o @usuario." });
          return usuario ?? "";
        })
        .optional(),
    ),
    site: z.preprocess(
      vazioParaUndefined,
      z
        .string()
        .trim()
        .transform((v, ctx) => {
          const url = normalizarSite(v);
          if (!url) ctx.addIssue({ code: "custom", message: "Site inválido — use um endereço http ou https." });
          return url ?? "";
        })
        .optional(),
    ),
    profissaoIds: z.array(z.string().uuid()).max(8, "Escolha no máximo 8 profissões."),
  })
  .strict();

export const nomeTaxonomiaSchema = z.string().trim().min(2, "Informe o nome (mínimo 2 letras).").max(80);

export const novaCategoriaSchema = z
  .object({ nome: nomeTaxonomiaSchema, paiId: z.string().uuid().optional() })
  .strict();

export const atualizarCategoriaSchema = z
  .object({
    nome: nomeTaxonomiaSchema.optional(),
    paiId: z.string().uuid().nullable().optional(),
    ordem: z.number().int().min(0).max(10_000).optional(),
    ativo: z.boolean().optional(),
  })
  .strict();

export const novaProfissaoSchema = z
  .object({ nome: nomeTaxonomiaSchema, categoriaId: z.string().uuid() })
  .strict();

export const atualizarProfissaoSchema = z
  .object({
    nome: nomeTaxonomiaSchema.optional(),
    categoriaId: z.string().uuid().optional(),
    ativo: z.boolean().optional(),
  })
  .strict();

export const filtrosBuscaSchema = z
  .object({
    q: z.string().trim().max(80).optional(),
    profissao: z.string().trim().max(80).optional(),
    categoria: z.string().trim().max(80).optional(),
    estado: z.enum(SIGLAS_UF).optional(),
    cidade: z.string().trim().max(100).optional(),
    tipo: z.enum(["pj", "pf"]).optional(),
    pagina: z.number().int().min(1).max(500).optional(),
  })
  .strict();

export const suspenderPerfilSchema = z
  .object({
    slug: z.string().regex(/^[a-z0-9-]{1,80}$/),
    motivo: z.string().trim().min(5, "Descreva o motivo (mínimo 5 letras).").max(500),
  })
  .strict();
