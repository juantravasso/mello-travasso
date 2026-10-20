// Datas do ciclo de vida do teste. Funções puras (sem relógio global): quem chama passa o "agora".
// O Brasil não tem horário de verão desde 2019, então America/Sao_Paulo é um deslocamento fixo de -03:00,
// o mesmo critério de src/lib/auth/plano.ts.

export const DIA_MS = 24 * 60 * 60 * 1000;
const HORA_MS = 60 * 60 * 1000;
const MINUTO_MS = 60 * 1000;
const DESLOCAMENTO_LOCAL_MS = 3 * HORA_MS;
/** Do início do dia local (00:00) até o fim do teste (23:59). */
const INICIO_ATE_FIM_DO_DIA_MS = 23 * HORA_MS + 59 * MINUTO_MS;

/** Atraso máximo aceito para uma campanha ou aviso: passado isso, o momento certo já foi e não se envia mais. */
export const TOLERANCIA_CAMPANHA_MS = 3 * DIA_MS;
export const TOLERANCIA_AVISO_MS = 2 * DIA_MS;

/** 23:59 (horário de Brasília) do dia local em que cai o instante. */
export function fimDoDiaLocal(instante: Date): Date {
  const local = new Date(instante.getTime() - DESLOCAMENTO_LOCAL_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), 23 + 3, 59, 0, 0));
}

/** Fim de um teste que começa agora e dura `dias`. */
export function fimDoTesteEmDias(agora: Date, dias: number): Date {
  return fimDoDiaLocal(new Date(agora.getTime() + dias * DIA_MS));
}

/**
 * Novo fim depois de uma extensão. Soma `dias` ao fim atual; se o teste já venceu, conta a partir de hoje
 * (somar ao fim antigo poderia deixar o teste ainda vencido).
 */
export function fimDepoisDaExtensao(fimAtual: Date, agora: Date, dias: number): Date {
  const base = Math.max(fimAtual.getTime(), agora.getTime());
  return fimDoDiaLocal(new Date(base + dias * DIA_MS));
}

export function diasAteOFim(fim: Date, agora: Date): number {
  return Math.ceil((fim.getTime() - agora.getTime()) / DIA_MS);
}

/** Quando o aviso "faltam N dias" passa a valer: 00:00 local do dia do término menos N dias. */
export function momentoDoAvisoDeFim(fim: Date, diasAntes: number): Date {
  return new Date(fim.getTime() - INICIO_ATE_FIM_DO_DIA_MS - diasAntes * DIA_MS);
}

/** O aviso já pode sair, ainda não está atrasado demais e não fala de um fim que já passou. */
export function avisoDeFimEstaNaJanela(fim: Date, diasAntes: number, agora: Date): boolean {
  const momento = momentoDoAvisoDeFim(fim, diasAntes).getTime();
  const t = agora.getTime();
  if (t < momento || t - momento > TOLERANCIA_AVISO_MS) return false;
  return t <= fim.getTime();
}

/** A campanha "N dias depois do cadastro" já venceu e ainda está dentro da tolerância. */
export function campanhaEstaDevida(criadoEm: Date, aposDias: number, agora: Date): boolean {
  const momento = criadoEm.getTime() + aposDias * DIA_MS;
  const t = agora.getTime();
  return t >= momento && t - momento <= TOLERANCIA_CAMPANHA_MS;
}

/** "dd/mm" no horário de Brasília. */
export function formatarDiaMes(instante: Date): string {
  return instante.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
}

/** "dd/mm/aaaa" no horário de Brasília. */
export function formatarDataCompleta(instante: Date): string {
  return instante.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo" });
}
