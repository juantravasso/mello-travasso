import { z } from "zod";

export const novoProdutoSchema = z
  .object({
    nome: z.string().trim().min(1, "Informe o nome do produto").max(200),
    sku: z.string().trim().max(80).optional(),
    categoria: z.string().trim().max(100).optional(),
    unidade: z.string().trim().max(20).optional(),
    estoqueMinimo: z.number().nonnegative().optional(),
    observacao: z.string().trim().max(2000).optional(),
  })
  .strict();

export const movimentoEstoqueSchema = z
  .object({
    produtoId: z.string().uuid(),
    obraId: z.string().uuid(),
    tipo: z.enum(["entrada", "saida", "ajuste"]),
    // Para "ajuste" isto é o saldo final desejado (não a diferença) — RF-04.
    quantidade: z.number().nonnegative(),
    // Só para "ajuste": o saldo que a UI mostrou quando o usuário preencheu o
    // formulário — usado como precondição otimista contra uma entrada/saída
    // concorrente entre a UI carregar e o envio (ver ajustarSaldo/definirSaldo
    // em estoqueActions.ts).
    saldoEsperado: z.number().nonnegative().optional(),
    valorUnitario: z.number().nonnegative().optional(),
    observacao: z.string().trim().max(500).optional(),
  })
  .strict()
  .superRefine((dados, ctx) => {
    if (dados.tipo === "ajuste" && dados.saldoEsperado === undefined) {
      ctx.addIssue({ code: "custom", path: ["saldoEsperado"], message: "Informe o saldo esperado." });
    }
    if (dados.tipo !== "ajuste" && dados.quantidade <= 0) {
      ctx.addIssue({ code: "custom", path: ["quantidade"], message: "Informe uma quantidade maior que zero." });
    }
  });
