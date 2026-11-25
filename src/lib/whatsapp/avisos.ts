// Avisos da conta pelo WhatsApp: textos e regras de envio. Puro e testável. O provedor hoje é NÃO oficial (risco de
// bloqueio do número), então o envio é contido: só em horário comercial, poucos por rodada, com intervalo, e com teto
// diário. Aviso que perdeu o sentido (passou de `expiraEm`) é cancelado, nunca enviado atrasado.

export type TipoAvisoWhatsapp = "fim_do_teste" | "renovacao_plano" | "plano_suspenso";

/** Janela de envio no fuso da empresa: das 8h às 20h (exclusivo). */
export const HORA_INICIO = 8;
export const HORA_FIM = 20;
/** Avisos por rodada do agendador (a cada 15 min) e intervalo entre mensagens. */
export const POR_RODADA = 10;
export const INTERVALO_MS = 1500;
/** Teto de avisos enviados em 24 h (todas as empresas). Sobrescrito por WHATSAPP_AVISOS_DIA. */
export const TETO_DIARIO_PADRAO = 60;
export const MAX_TENTATIVAS = 3;

export function tetoDiario(bruto: string | undefined): number {
  const n = Number.parseInt(bruto ?? "", 10);
  return Number.isFinite(n) && n >= 0 && n <= 1000 ? n : TETO_DIARIO_PADRAO;
}

/** Hora (0–23) do instante no fuso dado. Fuso inválido cai em America/Sao_Paulo. */
export function horaNoFuso(instante: Date, fuso: string): number {
  const formatar = (tz: string) => Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: tz }).format(instante));
  try {
    return formatar(fuso);
  } catch {
    return formatar("America/Sao_Paulo");
  }
}

export function dentroDoHorario(instante: Date, fuso: string): boolean {
  const h = horaNoFuso(instante, fuso);
  return h >= HORA_INICIO && h < HORA_FIM;
}

/** Espera entre tentativas: 15 min, 1 h, 4 h. */
export function proximaTentativa(agora: Date, tentativas: number): Date {
  const minutos = [15, 60, 240][Math.min(tentativas, 2)];
  return new Date(agora.getTime() + minutos * 60_000);
}

const dataBr = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo" });

const RODAPE = "Para não receber estes avisos aqui, desligue em Configurações → WhatsApp.";

export function textoFimDoTeste(diasAntes: number, fimIso: string, urlPlanos: string): string {
  const quando = diasAntes === 0 ? "termina hoje" : diasAntes === 1 ? "termina amanhã" : `termina em ${diasAntes} dias`;
  return [
    `Elo Negócios: o teste da sua empresa ${quando} (${dataBr(fimIso)}).`,
    "Depois disso os dados continuam disponíveis para consulta, mas não dá para lançar nada novo.",
    `Para continuar usando: ${urlPlanos}`,
    "",
    RODAPE,
  ].join("\n");
}

export function textoRenovacao(rotuloCiclo: string, nomePlano: string, vencimentoIso: string, urlPlanos: string): string {
  return [
    `Elo Negócios: sua assinatura ${rotuloCiclo} do plano ${nomePlano} vence em ${dataBr(vencimentoIso)}.`,
    `Para renovar sem interrupção: ${urlPlanos}`,
    "",
    RODAPE,
  ].join("\n");
}

export function textoPlanoSuspenso(nomePlano: string, urlPlanos: string): string {
  return [
    `Elo Negócios: a assinatura do plano ${nomePlano} venceu sem renovação, e a empresa ficou em modo somente leitura.`,
    "Seus dados estão guardados e continuam disponíveis para consulta.",
    `Para voltar a lançar: ${urlPlanos}`,
    "",
    RODAPE,
  ].join("\n");
}
