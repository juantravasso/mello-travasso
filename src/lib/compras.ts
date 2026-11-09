import { normalizarDescricao } from "@/lib/normalizarTexto";
import type { ItemCompra, MotivoSugestao } from "@/types";

// Regras puras da compra: totais, chaves da memória de identificação e a sugestão de produto. Sem acesso a banco, para
// valer igual na tela (prévia) e no servidor (que recalcula tudo e nunca confia nos totais que vieram do navegador).

const arredondar = (v: number) => Math.round(v * 100 + 1e-6) / 100;

export function formatarNumeroCompra(numero: number): string {
  return String(numero).padStart(6, "0");
}

/** Total do item: quantidade × valor unitário − desconto, sem ficar negativo. */
export function totalDoItem(quantidade: number, valorUnitario: number, desconto: number): number {
  return Math.max(0, arredondar(quantidade * valorUnitario - desconto));
}

export interface TotaisCompra {
  valorProdutos: number;
  descontoTotal: number;
  valorTotal: number;
}

export function totaisDaCompra(
  itens: Pick<ItemCompra, "valorTotal" | "desconto">[],
  frete: number,
  seguro: number,
  outrasDespesas: number,
): TotaisCompra {
  const valorProdutos = arredondar(itens.reduce((s, i) => s + i.valorTotal, 0));
  const descontoTotal = arredondar(itens.reduce((s, i) => s + i.desconto, 0));
  return { valorProdutos, descontoTotal, valorTotal: arredondar(valorProdutos + frete + seguro + outrasDespesas) };
}

/** Quem vendeu: o id do cadastro ou, sem cadastro, o nome normalizado. */
export function chaveFornecedor(fornecedorId: string | undefined, nome: string | undefined): string {
  if (fornecedorId) return fornecedorId;
  return nome ? normalizarDescricao(nome) : "";
}

/** O que identifica o item no fornecedor: o código dele ou, sem código, a descrição normalizada. */
export function chaveDoItem(codigoFornecedor: string | undefined, descricao: string): string {
  const codigo = codigoFornecedor?.trim();
  return codigo ? `c:${normalizarDescricao(codigo)}` : `d:${normalizarDescricao(descricao).replace(/\s+/g, " ")}`;
}

const PALAVRAS_SOLTAS = new Set(["de", "da", "do", "com", "para", "p", "c", "e", "a", "o", "em", "un", "pc", "cx"]);

function palavras(texto: string): Set<string> {
  return new Set(
    normalizarDescricao(texto)
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter((p) => p.length > 1 && !PALAVRAS_SOLTAS.has(p)),
  );
}

/** Parecença entre duas descrições, de 0 a 1 (palavras em comum sobre o total de palavras). */
export function similaridade(a: string, b: string): number {
  const pa = palavras(a);
  const pb = palavras(b);
  if (pa.size === 0 || pb.size === 0) return 0;
  let comuns = 0;
  for (const p of pa) if (pb.has(p)) comuns++;
  return comuns / (pa.size + pb.size - comuns);
}

export const LIMITE_PARECIDO = 0.6;

export interface ProdutoParaSugestao {
  id: string;
  nome: string;
}

export interface ResultadoSugestao {
  produtoId: string;
  motivo: MotivoSugestao;
}

/** Sugere o produto do catálogo de um item: primeiro o vínculo já feito, depois nome igual, depois o mais parecido. */
export function sugerirProduto(
  item: { descricao: string; codigoFornecedor?: string },
  vinculos: ReadonlyMap<string, string>,
  produtos: readonly ProdutoParaSugestao[],
): ResultadoSugestao | null {
  const vinculado = vinculos.get(chaveDoItem(item.codigoFornecedor, item.descricao));
  if (vinculado && produtos.some((p) => p.id === vinculado)) return { produtoId: vinculado, motivo: "vinculo" };
  // Código sem vínculo ainda: tenta o vínculo pela descrição (a mesma coisa comprada sem código antes).
  if (item.codigoFornecedor) {
    const porDescricao = vinculos.get(chaveDoItem(undefined, item.descricao));
    if (porDescricao && produtos.some((p) => p.id === porDescricao)) return { produtoId: porDescricao, motivo: "vinculo" };
  }
  const alvo = normalizarDescricao(item.descricao);
  const igual = produtos.find((p) => normalizarDescricao(p.nome) === alvo);
  if (igual) return { produtoId: igual.id, motivo: "nome" };
  let melhor: { id: string; nota: number } | null = null;
  for (const p of produtos) {
    const nota = similaridade(item.descricao, p.nome);
    if (nota >= LIMITE_PARECIDO && (!melhor || nota > melhor.nota)) melhor = { id: p.id, nota };
  }
  return melhor ? { produtoId: melhor.id, motivo: "parecido" } : null;
}
