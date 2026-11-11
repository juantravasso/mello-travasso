import { z } from "zod";

// Catálogo comercial: validação e cálculos de preço. Tudo puro. O valor exibido é sempre o cadastrado pela
// administração; a economia anual só existe quando os dois preços existem e o anual realmente sai mais barato.

const reais = (centavos: number) => (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function formatarPreco(centavos: number | null): string | null {
  return centavos === null ? null : reais(centavos);
}

export interface PrecosDoPlano {
  precoMensalCentavos: number | null;
  precoAnualCentavos: number | null;
}

/** Economia do anual frente a 12 mensalidades, em centavos e em %. null se faltar preço ou se o anual não compensar. */
export function economiaAnual(p: PrecosDoPlano): { centavos: number; percentual: number } | null {
  if (p.precoMensalCentavos === null || p.precoAnualCentavos === null) return null;
  const cheio = p.precoMensalCentavos * 12;
  const centavos = cheio - p.precoAnualCentavos;
  if (cheio <= 0 || centavos <= 0) return null;
  return { centavos, percentual: Math.round((centavos / cheio) * 100) };
}

/** Vagas que sobram. Nunca negativo, e sem limite (null) não existe contagem. */
export function vagasRestantes(total: number | null, ocupadas: number): number | null {
  if (total === null) return null;
  return Math.max(0, total - Math.max(0, ocupadas));
}

/** Quanto o anual equivale por mês (anual ÷ 12, arredondado ao centavo). null se não houver preço anual. */
export function mensalEquivalente(anualCentavos: number | null): number | null {
  return anualCentavos === null ? null : Math.round(anualCentavos / 12);
}

/** Quanto sobra por ano pagando o plano barato em vez do outro, ambos pelo mensal. null se não houver diferença a favor. */
export function diferencaAnualEntrePlanos(barato: number | null, caro: number | null): number | null {
  if (barato === null || caro === null || caro <= barato) return null;
  return (caro - barato) * 12;
}

export const CHAVE_PLANO = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const preco = z.number().int("Preço em centavos inteiros.").min(1, "Preço precisa ser maior que zero.").max(100_000_00, "Preço acima do limite.").nullable();

export const planoComercialSchema = z
  .object({
    chave: z.string().trim().min(2).max(30).regex(CHAVE_PLANO, "A chave usa letras minúsculas, números e hífens."),
    nome: z.string().trim().min(2, "Informe o nome.").max(60),
    descricao: z.string().trim().min(5, "Descreva o plano em uma frase.").max(240),
    precoMensalCentavos: preco,
    precoAnualCentavos: preco,
    beneficios: z
      .array(z.string().trim().min(2).max(140))
      .max(12, "No máximo 12 benefícios.")
      .transform((l) => [...new Set(l)]),
    destaque: z.boolean(),
    publicado: z.boolean(),
    ordem: z.number().int().min(0).max(99),
    vagasTotal: z.number().int().min(1, "Vagas: no mínimo 1.").max(10_000).nullable(),
    condicao: z.string().trim().min(3).max(120).nullable(),
  })
  .strict()
  .refine((p) => !p.publicado || p.beneficios.length > 0, { message: "Para publicar, liste ao menos um benefício.", path: ["beneficios"] });

export type PlanoComercialEntrada = z.infer<typeof planoComercialSchema>;

/** Converte "49,90" ou "49.90" em centavos; vazio vira null; texto inválido vira NaN (a validação recusa). */
export function reaisParaCentavos(texto: string): number | null {
  const limpo = texto.trim().replace(/^R\$\s*/i, "");
  if (limpo === "") return null;
  if (!/^\d{1,6}([.,]\d{1,2})?$/.test(limpo)) return Number.NaN;
  return Math.round(Number(limpo.replace(",", ".")) * 100);
}

export function centavosParaReais(centavos: number | null): string {
  return centavos === null ? "" : (centavos / 100).toFixed(2).replace(".", ",");
}

export const CONTEXTOS_OFERTA = ["gestao_bloqueada", "teste_encerrado", "pagina_planos"] as const;
export type ContextoOferta = (typeof CONTEXTOS_OFERTA)[number];
