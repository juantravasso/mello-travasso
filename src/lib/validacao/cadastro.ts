import { z } from "zod";
import { emailSchema, senhaSchema } from "./auth";
import { documentoValido } from "./documento";

// Campo honeypot (RF-21): um humano nunca vê nem preenche este campo (fica
// escondido via CSS, não `type="hidden"`, que alguns bots ignoram
// deliberadamente). Não é validado aqui — a action confere separadamente e
// responde sucesso falso, sem revelar ao bot que foi pego.
export const criarContaSchema = z
  .object({
    tipoPessoa: z.enum(["pj", "pf"]),
    documento: z.string().min(1, "Informe o documento"),
    razaoSocial: z.string().trim().min(1, "Informe o nome").max(200),
    nomeFantasia: z.string().trim().max(200).optional(),
    situacaoCadastral: z.string().trim().max(60).optional(),
    telefone: z.string().trim().max(30).optional(),
    cep: z.string().trim().max(10).optional(),
    logradouro: z.string().trim().max(200).optional(),
    numero: z.string().trim().max(20).optional(),
    complemento: z.string().trim().max(100).optional(),
    bairro: z.string().trim().max(100).optional(),
    cidade: z.string().trim().max(100).optional(),
    estado: z.string().trim().max(2).optional(),
    nomeUsuario: z.string().trim().min(1, "Informe seu nome").max(160),
    email: emailSchema,
    senha: senhaSchema,
    /** "teste": 30 dias com todos os módulos. "rede": só a rede profissional, grátis. */
    modo: z.enum(["teste", "rede"]).default("teste"),
    /** Código do link de convite que trouxe a pessoa. Só o formato é limitado aqui: código inválido é ignorado no servidor. */
    codigoConvite: z.string().trim().max(40).optional(),
    aceiteTermos: z.boolean().refine((v) => v === true, "É preciso aceitar os Termos e a Política de Privacidade."),
    empresaConfirmacao: z.string().max(500).optional(),
  })
  .strict()
  .refine((dados) => documentoValido(dados.documento, dados.tipoPessoa), {
    message: "documento_invalido",
    path: ["documento"],
  });
