import type { ContaFinanceira, Funcionario, ItemProduto, Obra } from "@/types";

const DB_KEY = "mello-travasso:db:v3";

interface Banco {
  obras: Obra[];
  contas: ContaFinanceira[];
  itensProduto: ItemProduto[];
  funcionarios: Funcionario[];
}

function bancoVazio(): Banco {
  return { obras: [], contas: [], itensProduto: [], funcionarios: [] };
}

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

/**
 * Armazenamento local (localStorage) usado enquanto não há backend.
 * Isolado nesta função para que a troca por uma API HTTP futura fique
 * restrita aos arquivos de repositório, sem tocar em hooks/UI.
 */
export function lerBanco(): Banco {
  if (!isBrowser()) return bancoVazio();
  const bruto = window.localStorage.getItem(DB_KEY);
  if (!bruto) return bancoVazio();
  try {
    const dados = JSON.parse(bruto) as Partial<Banco>;
    return {
      obras: dados.obras ?? [],
      contas: dados.contas ?? [],
      itensProduto: dados.itensProduto ?? [],
      funcionarios: dados.funcionarios ?? [],
    };
  } catch {
    return bancoVazio();
  }
}

export function salvarBanco(banco: Banco): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(DB_KEY, JSON.stringify(banco));
}

export function gerarId(prefixo: string): string {
  const aleatorio =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `${prefixo}_${aleatorio}`;
}

export function agoraISO(): string {
  return new Date().toISOString();
}

export function semearBancoSeVazio(seed: Banco): void {
  if (!isBrowser()) return;
  const atual = lerBanco();
  if (atual.obras.length === 0 && atual.contas.length === 0) {
    salvarBanco(seed);
  }
}
