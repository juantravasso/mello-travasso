import { z } from "zod";

// Edição do perfil da empresa (RF-20) — documento e tipoPessoa não entram
// aqui de propósito: não são editáveis depois do cadastro.
export const atualizarEmpresaSchema = z
  .object({
    razaoSocial: z.string().trim().min(1, "Informe o nome").max(200),
    nomeFantasia: z.string().trim().max(200).optional(),
    telefone: z.string().trim().max(30).optional(),
    cep: z.string().trim().max(10).optional(),
    logradouro: z.string().trim().max(200).optional(),
    numero: z.string().trim().max(20).optional(),
    complemento: z.string().trim().max(100).optional(),
    bairro: z.string().trim().max(100).optional(),
    cidade: z.string().trim().max(100).optional(),
    estado: z.string().trim().max(2).optional(),
  })
  .strict();
