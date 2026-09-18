/** Normaliza CPF/CNPJ para dígitos apenas — é essa forma que fica salva no banco e usada como chave de busca. */
export function normalizarDocumento(valor?: string): string | undefined {
  const digitos = valor?.replace(/\D/g, "") ?? "";
  return digitos.length > 0 ? digitos : undefined;
}

/** Formata dígitos de CPF (11) ou CNPJ (14) para exibição; qualquer outro tamanho volta como veio. */
export function formatarCpfCnpj(valor?: string): string {
  const digitos = normalizarDocumento(valor);
  if (!digitos) return "";
  if (digitos.length === 11) {
    return digitos.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  if (digitos.length === 14) {
    return digitos.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }
  return digitos;
}
