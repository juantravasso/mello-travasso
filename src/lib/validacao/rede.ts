import { z } from "zod";
import { SIGLAS_UF } from "@/lib/rede/ufs";
import { normalizarInstagram, normalizarSite, normalizarTelefone } from "@/lib/rede/texto";
import { CHAVES_NEGATIVAS, CHAVES_POSITIVAS, motivosParaAlvo } from "@/lib/rede/aspectos";
import { cnpjValido } from "./documento";

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
    notaMin: z.number().min(1).max(5).optional(),
    pagina: z.number().int().min(1).max(500).optional(),
  })
  .strict();

export const suspenderPerfilSchema = z
  .object({
    slug: z.string().regex(/^[a-z0-9-]{1,80}$/),
    motivo: z.string().trim().min(5, "Descreva o motivo (mínimo 5 letras).").max(500),
  })
  .strict();

const slugPerfil = z.string().regex(/^[a-z0-9-]{1,80}$/);

export const salvarAvaliacaoSchema = z
  .object({
    perfilSlug: slugPerfil,
    nota: z.number().int("Escolha uma nota de 1 a 5.").min(1, "Escolha uma nota de 1 a 5.").max(5, "Escolha uma nota de 1 a 5."),
    comentario: textoOpcional(1500),
    pros: z
      .array(z.enum(CHAVES_POSITIVAS))
      .max(CHAVES_POSITIVAS.length)
      .transform((lista) => [...new Set(lista)]),
    contras: z
      .array(z.enum(CHAVES_NEGATIVAS))
      .max(CHAVES_NEGATIVAS.length)
      .transform((lista) => [...new Set(lista)]),
  })
  .strict();

export const responderAvaliacaoSchema = z
  .object({
    avaliacaoId: z.string().uuid(),
    texto: z.string().trim().min(5, "Escreva a resposta (mínimo 5 letras).").max(1500),
  })
  .strict();

export const indicarEmpresaSchema = z
  .object({
    nome: z
      .string()
      .trim()
      .min(2, "Informe o nome.")
      .max(120)
      .refine((v) => !/https?:|www[.]|@|[0-9]{5,}/i.test(v), "O nome não pode ter endereço, e-mail ou número de telefone."),
    tipo: z.enum(["pj", "pf"]),
    profissaoId: z.string().uuid("Escolha a profissão."),
    estado: z.enum(SIGLAS_UF, "Escolha o estado."),
    cidade: z.string().trim().min(2, "Informe a cidade.").max(100),
    documento: z.preprocess(vazioParaUndefined, z.string().trim().max(30).optional()),
  })
  .strict()
  .superRefine((dados, ctx) => {
    if (dados.tipo === "pf" && dados.documento) {
      ctx.addIssue({ code: "custom", path: ["documento"], message: "Não pedimos CPF: deixe em branco para autônomos." });
    }
    if (dados.tipo === "pj" && dados.documento && !cnpjValido(dados.documento)) {
      ctx.addIssue({ code: "custom", path: ["documento"], message: "CNPJ inválido — confira os 14 dígitos." });
    }
  });

export const slugSchema = slugPerfil;

export const moderarAvaliacaoSchema = z
  .object({
    avaliacaoId: z.string().uuid(),
    acao: z.enum(["ocultar", "remover", "restaurar"]),
    motivo: z.string().trim().min(5, "Descreva o motivo (mínimo 5 letras).").max(500),
  })
  .strict();

const MOTIVOS = [
  "fraude",
  "avaliacao_falsa",
  "nunca_trabalhou",
  "conteudo_ofensivo",
  "spam",
  "informacao_falsa",
  "conflito_interesse",
  "outro",
] as const;

export const denunciarSchema = z
  .object({
    alvo: z.discriminatedUnion("tipo", [
      z.object({ tipo: z.literal("avaliacao"), avaliacaoId: z.string().uuid() }).strict(),
      z.object({ tipo: z.literal("perfil"), perfilSlug: slugPerfil }).strict(),
    ]),
    motivo: z.enum(MOTIVOS, "Escolha o motivo."),
    descricao: z.string().trim().min(10, "Descreva o problema (mínimo 10 letras).").max(1000),
  })
  .strict()
  .refine((d) => motivosParaAlvo(d.alvo.tipo).some((m) => m.chave === d.motivo), {
    message: "Esse motivo não vale para este tipo de denúncia.",
    path: ["motivo"],
  });

export const complementarDenunciaSchema = z
  .object({
    denunciaId: z.string().uuid(),
    texto: z.string().trim().min(5, "Escreva a informação (mínimo 5 letras).").max(1000),
  })
  .strict();

export const solicitarInformacoesSchema = z
  .object({
    denunciaId: z.string().uuid(),
    mensagem: z.string().trim().min(5, "Escreva o que precisa ser esclarecido (mínimo 5 letras).").max(500),
  })
  .strict();

export const decidirDenunciaSchema = z
  .object({
    denunciaId: z.string().uuid(),
    acao: z.enum(["manter", "ocultar_avaliacao", "remover_avaliacao", "suspender_perfil"]),
    mensagem: z.string().trim().min(5, "Escreva a mensagem ao denunciante (mínimo 5 letras).").max(500),
    observacao: z.preprocess(vazioParaUndefined, z.string().trim().max(1000).optional()),
  })
  .strict();
