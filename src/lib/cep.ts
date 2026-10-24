// CEP: só os dígitos importam; a máscara é "00000-000". Funções puras, sem rede.

export function digitosDoCep(valor: string): string {
  return valor.replace(/\D/g, "").slice(0, 8);
}

/** "20040020" → "20040-020"; vai formatando enquanto a pessoa digita ("200400" → "20040-0"). */
export function formatarCep(valor: string): string {
  const d = digitosDoCep(valor);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

export function cepCompleto(valor: string): boolean {
  return digitosDoCep(valor).length === 8;
}
