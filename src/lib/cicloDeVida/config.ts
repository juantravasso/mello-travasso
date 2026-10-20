import { z } from "zod";

// Configuração do ciclo de vida do cliente (duração do teste, limites de extensão, campanhas de e-mail). Fica numa
// linha de ConfiguracaoPlataforma, editada pelo administrador. Valor ausente ou inválido volta ao padrão abaixo, então
// uma edição manual errada no banco nunca derruba o cadastro nem o agendador.

export const CHAVE_CONFIG_CICLO = "ciclo_de_vida";

const inteiro = (min: number, max: number) => z.number().int().min(min).max(max);

const campanhaComAtraso = z.object({ ativa: z.boolean(), aposDias: inteiro(1, 30) }).strict();

export const configCicloSchema = z
  .object({
    /** Duração padrão do teste de quem se cadastra ou inicia o teste. Quem já está em teste mantém a data que tem. */
    testeDias: inteiro(1, 90),
    extensao: z
      .object({
        ativa: z.boolean(),
        /** Quantas extensões uma empresa pode receber, no total. */
        maxExtensoes: inteiro(0, 5),
        maxDiasPorExtensao: inteiro(1, 60),
        /** Soma máxima de dias estendidos por empresa. */
        maxDiasTotal: inteiro(1, 120),
      })
      .strict()
      .refine((e) => e.maxDiasPorExtensao <= e.maxDiasTotal, {
        message: "O limite por extensão não pode passar do limite total.",
        path: ["maxDiasPorExtensao"],
      }),
    emails: z
      .object({
        /** Chave geral: desligada, nada é enviado (a fila só acumula o que já estava agendado). */
        ativos: z.boolean(),
        /** Quando os e-mails foram ligados. Dicas e boas-vindas só valem para quem se cadastrou depois disso. */
        ativadoEm: z.string().nullable(),
        boasVindas: z.object({ ativa: z.boolean() }).strict(),
        primeiraAcao: campanhaComAtraso,
        problema: campanhaComAtraso,
        recursos: campanhaComAtraso,
        fimDoTeste: z
          .object({
            ativa: z.boolean(),
            /** 0 = no dia do término. */
            diasAntes: z
              .array(inteiro(0, 14))
              .min(1)
              .max(4)
              .transform((lista) => [...new Set(lista)].sort((a, b) => b - a)),
          })
          .strict(),
      })
      .strict(),
  })
  .strict();

export type ConfigCicloDeVida = z.infer<typeof configCicloSchema>;

export const CONFIG_PADRAO: ConfigCicloDeVida = {
  testeDias: 14,
  extensao: { ativa: true, maxExtensoes: 1, maxDiasPorExtensao: 14, maxDiasTotal: 14 },
  emails: {
    // Começa desligado de propósito: ninguém recebe e-mail novo sem o administrador ligar.
    ativos: false,
    ativadoEm: null,
    boasVindas: { ativa: true },
    primeiraAcao: { ativa: true, aposDias: 1 },
    problema: { ativa: true, aposDias: 3 },
    recursos: { ativa: true, aposDias: 7 },
    fimDoTeste: { ativa: true, diasAntes: [3, 1, 0] },
  },
};

/** Valor guardado no banco → configuração válida (ou o padrão). */
export function lerConfigCiclo(bruto: unknown): ConfigCicloDeVida {
  const resultado = configCicloSchema.safeParse(bruto);
  return resultado.success ? resultado.data : CONFIG_PADRAO;
}
