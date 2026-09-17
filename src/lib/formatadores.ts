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
