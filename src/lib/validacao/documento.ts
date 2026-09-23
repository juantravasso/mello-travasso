// Validação de dígito verificador (DV) de CPF e CNPJ — algoritmo mod-11
// padrão da Receita Federal. Usado no cadastro (RF-02, RF-04): o formato
// "11/14 dígitos" não basta, precisa bater o DV para não aceitar número
// obviamente inválido (ex.: todos os dígitos iguais).

function apenasDigitos(valor: string): string {
  return valor.replace(/\D/g, "");
}

function digitosIguais(digitos: string): boolean {
  return digitos.split("").every((d) => d === digitos[0]);
}

function calcularDvModulo11(digitos: string, pesos: number[]): number {
  const soma = digitos.split("").reduce((acc, digito, i) => acc + Number(digito) * pesos[i]!, 0);
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

export function cpfValido(valor: string): boolean {
  const digitos = apenasDigitos(valor);
  if (digitos.length !== 11 || digitosIguais(digitos)) return false;

  const dv1 = calcularDvModulo11(digitos.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  const dv2 = calcularDvModulo11(digitos.slice(0, 9) + dv1, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  return digitos === digitos.slice(0, 9) + dv1 + dv2;
}

export function cnpjValido(valor: string): boolean {
  const digitos = apenasDigitos(valor);
  if (digitos.length !== 14 || digitosIguais(digitos)) return false;

  const dv1 = calcularDvModulo11(digitos.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const dv2 = calcularDvModulo11(digitos.slice(0, 12) + dv1, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return digitos === digitos.slice(0, 12) + dv1 + dv2;
}

export function documentoValido(valor: string, tipo: "pj" | "pf"): boolean {
  return tipo === "pj" ? cnpjValido(valor) : cpfValido(valor);
}
