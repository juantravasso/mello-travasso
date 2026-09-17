export function formatarMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatarData(dataISO: string): string {
  const [ano, mes, dia] = dataISO.slice(0, 10).split("-");
  if (!ano || !mes || !dia) return dataISO;
  return `${dia}/${mes}/${ano}`;
}

export function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatarDataHora(dataHoraISO: string): string {
  return new Date(dataHoraISO).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function adicionarMeses(dataISO: string, meses: number): string {
  const [ano, mes, dia] = dataISO.slice(0, 10).split("-").map(Number);
  const data = new Date(Date.UTC(ano ?? 1970, (mes ?? 1) - 1 + meses, dia ?? 1));
  return data.toISOString().slice(0, 10);
}
