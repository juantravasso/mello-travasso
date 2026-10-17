// Datas e horas locais de um fuso IANA, sem biblioteca. "Data" é "AAAA-MM-DD" e "hora" é "HH:mm", ambas como o
// usuário as vê; instantes são Date (UTC). A conversão considera o deslocamento do fuso naquele instante, então
// serve também para fusos com horário de verão.

const DATA = /^(\d{4})-(\d{2})-(\d{2})$/;
const HORA = /^([01]\d|2[0-3]):([0-5]\d)$/;
const MS_MINUTO = 60_000;

export function ehDataValida(valor: string): boolean {
  const m = DATA.exec(valor);
  if (!m) return false;
  const [ano, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  return d.getUTCFullYear() === ano && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia;
}

export function ehHoraValida(valor: string): boolean {
  return HORA.test(valor);
}

export function adicionarDias(data: string, dias: number): string {
  const m = DATA.exec(data);
  if (!m) throw new Error(`Data inválida: ${data}`);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + dias)).toISOString().slice(0, 10);
}

export function diferencaEmDias(de: string, ate: string): number {
  const a = DATA.exec(de);
  const b = DATA.exec(ate);
  if (!a || !b) throw new Error("Data inválida");
  const ms = Date.UTC(Number(b[1]), Number(b[2]) - 1, Number(b[3])) - Date.UTC(Number(a[1]), Number(a[2]) - 1, Number(a[3]));
  return Math.round(ms / 86_400_000);
}

const formatadores = new Map<string, Intl.DateTimeFormat>();

function formatador(fuso: string): Intl.DateTimeFormat {
  let f = formatadores.get(fuso);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: fuso,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatadores.set(fuso, f);
  }
  return f;
}

function camposLocais(instanteMs: number, fuso: string) {
  const partes: Record<string, number> = {};
  for (const p of formatador(fuso).formatToParts(new Date(instanteMs))) {
    if (p.type !== "literal") partes[p.type] = Number(p.value);
  }
  return partes;
}

/** Quantos minutos o relógio do fuso está à frente do UTC naquele instante (Brasília: -180). */
function deslocamentoMin(instanteMs: number, fuso: string): number {
  const c = camposLocais(instanteMs, fuso);
  const comoUtc = Date.UTC(c.year ?? 1970, (c.month ?? 1) - 1, c.day ?? 1, c.hour ?? 0, c.minute ?? 0, c.second ?? 0);
  return Math.round((comoUtc - Math.floor(instanteMs / 1000) * 1000) / MS_MINUTO);
}

/** O instante (UTC) em que o relógio do fuso marca `data` `hora`. */
export function instanteLocal(data: string, hora: string, fuso: string): Date {
  const d = DATA.exec(data);
  const h = HORA.exec(hora);
  if (!d || !h) throw new Error(`Data ou hora inválida: ${data} ${hora}`);
  const comoUtc = Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]), Number(h[1]), Number(h[2]));
  const primeiro = comoUtc - deslocamentoMin(comoUtc, fuso) * MS_MINUTO;
  const segundo = comoUtc - deslocamentoMin(primeiro, fuso) * MS_MINUTO;
  return new Date(segundo);
}

/** A data do calendário (AAAA-MM-DD) no fuso, para o instante dado. */
export function dataLocal(instante: Date, fuso: string): string {
  const c = camposLocais(instante.getTime(), fuso);
  const p = (n: number | undefined, tam: number) => String(n ?? 0).padStart(tam, "0");
  return `${p(c.year, 4)}-${p(c.month, 2)}-${p(c.day, 2)}`;
}

/** Último instante do dia local (um milissegundo antes da meia-noite seguinte). */
export function fimDoDiaLocal(data: string, fuso: string): Date {
  return new Date(instanteLocal(adicionarDias(data, 1), "00:00", fuso).getTime() - 1);
}

export interface PeriodoEntrada {
  data: string;
  diaInteiro: boolean;
  horaInicio?: string | null;
  horaFim?: string | null;
}

/** Instantes de início e fim do compromisso. Dia inteiro: da meia-noite ao último instante do dia local. */
export function periodoDoCompromisso(c: PeriodoEntrada, fuso: string): { inicioEm: string; fimEm: string } {
  if (c.diaInteiro) {
    return { inicioEm: instanteLocal(c.data, "00:00", fuso).toISOString(), fimEm: fimDoDiaLocal(c.data, fuso).toISOString() };
  }
  if (!c.horaInicio) throw new Error("Compromisso com horário precisa de horaInicio.");
  const inicio = instanteLocal(c.data, c.horaInicio, fuso);
  const fim = c.horaFim ? instanteLocal(c.data, c.horaFim, fuso) : inicio;
  return { inicioEm: inicio.toISOString(), fimEm: fim.toISOString() };
}
