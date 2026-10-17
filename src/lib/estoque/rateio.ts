// Rateio do valor de uma conta entre destinos (projetos e Depósito) e o custo de uma transferência. Funções puras:
// tudo em centavos inteiros, para a soma fechar exatamente no valor da conta (sem sobra nem falta de centavos).

export interface ItemParaRateio {
  obraId: string;
  valorTotal: number;
}

export interface Rateio {
  obraId: string;
  valor: number;
}

// A tolerância evita que 2,5 × 19,99 (= 49,975, mas 49,97499… em ponto flutuante) arredonde para baixo: meio centavo sobe.
const TOLERANCIA = 1e-6;
const paraCentavos = (valor: number) => Math.round(valor * 100 + TOLERANCIA);
const deCentavos = (centavos: number) => centavos / 100;

/**
 * Distribui `centavosTotal` entre os pesos pelo método do maior resto: cada destino recebe a parte inteira da sua
 * fatia e os centavos que sobram vão, um a um, para quem tem o maior resto. A soma é sempre `centavosTotal`.
 */
function distribuir(pesos: number[], centavosTotal: number): number[] {
  const soma = pesos.reduce((a, b) => a + b, 0);
  // Sem peso nenhum (itens de valor zero): divide igualmente.
  const efetivos = soma > 0 ? pesos : pesos.map(() => 1);
  const somaEfetiva = efetivos.reduce((a, b) => a + b, 0);
  const exatos = efetivos.map((p) => (centavosTotal * p) / somaEfetiva);
  const base = exatos.map(Math.floor);
  let faltam = centavosTotal - base.reduce((a, b) => a + b, 0);
  const ordem = exatos.map((e, i) => ({ i, resto: e - Math.floor(e) })).sort((a, b) => b.resto - a.resto || a.i - b.i);
  for (const { i } of ordem) {
    if (faltam <= 0) break;
    base[i] = (base[i] ?? 0) + 1;
    faltam--;
  }
  return base;
}

/**
 * Divide `valorConta` entre os destinos dos itens, proporcional ao valor de cada item. O que a nota tem além dos itens
 * (frete, impostos, arredondamento) é rateado na mesma proporção. A ordem dos destinos é a da primeira aparição.
 */
export function ratearConta(itens: readonly ItemParaRateio[], valorConta: number): Rateio[] {
  const porObra = new Map<string, number>();
  for (const item of itens) porObra.set(item.obraId, (porObra.get(item.obraId) ?? 0) + Math.max(item.valorTotal, 0));
  const obras = [...porObra.keys()];
  if (obras.length === 0) return [];
  const partes = distribuir(
    obras.map((o) => paraCentavos(porObra.get(o) ?? 0)),
    paraCentavos(valorConta),
  );
  return obras.map((obraId, i) => ({ obraId, valor: deCentavos(partes[i] ?? 0) }));
}

/** Aplica a mesma divisão a outro valor (cada parcela de uma conta parcelada), fechando os centavos da parcela. */
export function escalarRateios(rateios: readonly Rateio[], valorParcela: number): Rateio[] {
  if (rateios.length === 0) return [];
  const partes = distribuir(
    rateios.map((r) => paraCentavos(r.valor)),
    paraCentavos(valorParcela),
  );
  return rateios.map((r, i) => ({ obraId: r.obraId, valor: deCentavos(partes[i] ?? 0) }));
}

/** O destino com a maior parte da nota: vira o `obraId` da conta (listas e filtros antigos continuam funcionando). */
export function destinoPrincipal(rateios: readonly Rateio[]): string | undefined {
  let melhor: Rateio | undefined;
  for (const r of rateios) if (!melhor || r.valor > melhor.valor) melhor = r;
  return melhor?.obraId;
}

export interface ContaComRateio {
  obraId: string;
  valor: number;
  rateios?: readonly Rateio[];
}

/** Quanto desta conta pertence ao destino: o rateio, se houver; senão tudo vai para o projeto da conta. */
export function valorDoDestino(conta: ContaComRateio, obraId: string): number {
  if (conta.rateios && conta.rateios.length > 0) {
    return conta.rateios.filter((r) => r.obraId === obraId).reduce((s, r) => s + r.valor, 0);
  }
  return conta.obraId === obraId ? conta.valor : 0;
}

/** A conta toca este destino? (para listar no projeto as contas que têm uma parte dele) */
export function contaTocaDestino(conta: ContaComRateio, obraId: string): boolean {
  return valorDoDestino(conta, obraId) > 0 || (conta.obraId === obraId && !(conta.rateios && conta.rateios.length > 0));
}

/** Custo de transferir `quantidade` de um produto ao valor unitário da última compra. */
export function custoDaTransferencia(quantidade: number, valorUnitario: number): number {
  return deCentavos(paraCentavos(quantidade * valorUnitario));
}
