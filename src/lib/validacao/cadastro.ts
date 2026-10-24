import { z } from "zod";
import { emailSchema, senhaSchema } from "./auth";
import { documentoValido } from "./documento";

// Campo honeypot (RF-21): um humano nunca vê nem preenche este campo (fica
// escondido via CSS, não `type="hidden"`, que alguns bots ignoram
// deliberadamente). Não é validado aqui — a action confere separadamente e
// responde sucesso falso, sem revelar ao bot que foi pego.
//
// As mensagens dizem exatamente o que está errado e o que fazer: a tela mostra todas de uma vez, junto de cada campo.
export const criarContaSchema = z
  .object({
    tipoPessoa: z.enum(["pj", "pf"]),
    documento: z.string().min(1, "Informe o documento"),
    razaoSocial: z.string().trim().min(1, "Preencha o nome").max(200, "O nome pode ter no máximo 200 letras"),
    nomeFantasia: z.string().trim().max(200).optional(),
    situacaoCadastral: z.string().trim().max(60).optional(),
    telefone: z.string().trim().max(30, "O telefone está muito longo").optional(),
    cep: z.string().trim().max(10, "O CEP está muito longo").optional(),
    logradouro: z.string().trim().max(200, "O endereço pode ter no máximo 200 letras").optional(),
    numero: z.string().trim().max(20, "O número pode ter no máximo 20 caracteres").optional(),
    complemento: z.string().trim().max(100, "O complemento pode ter no máximo 100 letras").optional(),
    bairro: z.string().trim().max(100, "O bairro pode ter no máximo 100 letras").optional(),
    cidade: z.string().trim().max(100, "A cidade pode ter no máximo 100 letras").optional(),
    estado: z.string().trim().max(2, "Use a sigla do estado, com 2 letras (ex.: RJ)").optional(),
    nomeUsuario: z.string().trim().min(1, "Informe o seu nome").max(160, "O nome pode ter no máximo 160 letras"),
    email: emailSchema,
    senha: senhaSchema,
    /** "teste": período de teste com todos os módulos. "rede": só a rede profissional, grátis. */
    modo: z.enum(["teste", "rede"]).default("teste"),
    /** Código do link de convite que trouxe a pessoa. Só o formato é limitado aqui: código inválido é ignorado no servidor. */
    codigoConvite: z.string().trim().max(40).optional(),
    aceiteTermos: z.boolean().refine((v) => v === true, "Marque a caixa para aceitar os Termos de Uso e a Política de Privacidade."),
    empresaConfirmacao: z.string().max(500).optional(),
  })
  .strict()
  .superRefine((dados, contexto) => {
    if (documentoValido(dados.documento, dados.tipoPessoa)) return;
    contexto.addIssue({
      code: "custom",
      path: ["documento"],
      message:
        dados.tipoPessoa === "pf"
          ? "CPF inválido: confira os 11 números (algum dígito está errado)."
          : "CNPJ inválido: confira os 14 números (algum dígito está errado).",
    });
  });
