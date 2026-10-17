import { adicionarDias } from "./tempo";

// Aritmética de datas da grade do calendário, sobre datas puras "AAAA-MM-DD" (sem fuso e sem relógio do navegador).
// A semana começa no domingo, como no calendário brasileiro.

export type Visao = "mes" | "semana" | "dia";

export const DIAS_DA_SEMANA_CURTO = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;

function partes(data: string): { ano: number; mes: number; dia: number } {
  const [ano, mes, dia] = data.split("-").map(Number);
  return { ano: ano ?? 1970, mes: mes ?? 1, dia: dia ?? 1 };
}

/** 0 = domingo … 6 = sábado. */
export function diaDaSemana(data: string): number {
  const { ano, mes, dia } = partes(data);
  return new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay();
}

export function inicioDaSemana(data: string): string {
  return adicionarDias(data, -diaDaSemana(data));
}

export function primeiroDoMes(data: string): string {
  const { ano, mes } = partes(data);
  return `${String(ano).padStart(4, "0")}-${String(mes).padStart(2, "0")}-01`;
}

export function mesmoMes(a: string, b: string): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}

/** Seis semanas (42 dias) que cobrem o mês do cursor, começando no domingo. */
export function diasDaGradeMensal(cursor: string): string[] {
  const inicio = inicioDaSemana(primeiroDoMes(cursor));
  return Array.from({ length: 42 }, (_, i) => adicionarDias(inicio, i));
}

export function diasDaSemana(cursor: string): string[] {
  const inicio = inicioDaSemana(cursor);
  return Array.from({ length: 7 }, (_, i) => adicionarDias(inicio, i));
}

/** Período a buscar no servidor para a visão e o cursor dados. */
export function intervaloDaVisao(visao: Visao, cursor: string): { de: string; ate: string } {
  if (visao === "dia") return { de: cursor, ate: cursor };
  if (visao === "semana") {
    const dias = diasDaSemana(cursor);
    return { de: dias[0] ?? cursor, ate: dias[6] ?? cursor };
  }
  const dias = diasDaGradeMensal(cursor);
  return { de: dias[0] ?? cursor, ate: dias[41] ?? cursor };
}

/** Anda um período para frente (+1) ou para trás (-1). O mês cai no dia 1 para não pular meses curtos. */
export function deslocarCursor(visao: Visao, cursor: string, passos: number): string {
  if (visao === "dia") return adicionarDias(cursor, passos);
  if (visao === "semana") return adicionarDias(cursor, passos * 7);
  const { ano, mes } = partes(cursor);
  const alvo = new Date(Date.UTC(ano, mes - 1 + passos, 1));
  return alvo.toISOString().slice(0, 10);
}

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function mesAno(data: string): string {
  const { ano, mes } = partes(data);
  return `${MESES[mes - 1] ?? ""} de ${ano}`;
}

export function rotuloDoPeriodo(visao: Visao, cursor: string): string {
  if (visao === "mes") return mesAno(cursor);
  if (visao === "dia") {
    const { dia } = partes(cursor);
    return `${dia} de ${mesAno(cursor)}`;
  }
  const dias = diasDaSemana(cursor);
  const a = partes(dias[0] ?? cursor);
  const b = partes(dias[6] ?? cursor);
  if (a.mes === b.mes) return `${a.dia} a ${b.dia} de ${mesAno(dias[6] ?? cursor)}`;
  return `${a.dia} de ${MESES[a.mes - 1]} a ${b.dia} de ${mesAno(dias[6] ?? cursor)}`;
}

/** "terça-feira, 20 de outubro" para cabeçalhos de dia. */
export function rotuloDoDia(data: string): string {
  const { ano, mes, dia } = partes(data);
  return new Date(Date.UTC(ano, mes - 1, dia)).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
}
