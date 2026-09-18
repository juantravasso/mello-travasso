export function normalizarDescricao(descricao: string): string {
  return descricao
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}
