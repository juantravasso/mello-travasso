import { z } from "zod";

// Chamada de configuração: cada empresa nova é convidada a marcar uma conversa de poucos minutos com o fundador para
// deixar o sistema configurado. O agendamento acontece numa página externa (Cal.com, Calendly, Google Agenda); o app
// guarda só o link, o liga/desliga e o que cada empresa fez com o convite.

export const CHAVE_CONFIG_CHAMADA = "chamada_configuracao";
export const DURACAO_CHAMADA_MIN = 20;
/** Só empresas criadas há pouco são convidadas: quem já usa o sistema não ganha um pedido de ajuda de repente. */
export const DIAS_DO_CONVITE = 45;

export const ESTADOS_CHAMADA = ["agendada", "dispensada"] as const;
export type EstadoChamada = (typeof ESTADOS_CHAMADA)[number];

export const configChamadaSchema = z
  .object({
    ativa: z.boolean(),
    // Só https: o link é aberto por clientes, então nunca http, javascript: ou outro esquema.
    url: z
      .string()
      .trim()
      .max(500, "Link muito longo.")
      .refine((v) => v === "" || /^https:\/\/[^\s]+$/i.test(v), "Use o endereço completo da sua agenda, começando com https://"),
  })
  .strict()
  .refine((c) => !c.ativa || c.url !== "", { message: "Informe o link da agenda para ligar o convite.", path: ["url"] });

export type ConfigChamada = z.infer<typeof configChamadaSchema>;

export const CONFIG_CHAMADA_PADRAO: ConfigChamada = { ativa: false, url: "" };

/** Valor ausente ou inválido volta ao padrão (convite desligado): nunca mostra um link quebrado. */
export function lerConfigChamada(bruto: unknown): ConfigChamada {
  const r = configChamadaSchema.safeParse(bruto);
  return r.success ? r.data : CONFIG_CHAMADA_PADRAO;
}

export interface EntradaOferta {
  config: ConfigChamada;
  /** O que a empresa já fez com o convite (nulo = ainda não respondeu). */
  estado: string | null;
  criadaEm: string;
  agora: Date;
}

/** O convite aparece só com a função ligada e o link válido, para quem ainda não respondeu e é empresa recente. */
export function deveOferecerChamada({ config, estado, criadaEm, agora }: EntradaOferta): boolean {
  if (!config.ativa || config.url === "" || estado !== null) return false;
  const criada = new Date(criadaEm).getTime();
  if (Number.isNaN(criada)) return false;
  return agora.getTime() - criada <= DIAS_DO_CONVITE * 86_400_000;
}
