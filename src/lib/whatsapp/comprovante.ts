// Comprovante (Pix, transferência) pelo WhatsApp: o sistema pergunta do que se trata e, se houver mais de um, para qual
// projeto vai; com as respostas, lança a conta a pagar. Puro e testável: opções, leitura da resposta e textos.

export const VALIDADE_PENDENCIA_HORAS = 24;
export const MAX_PROJETOS_NA_LISTA = 9;

export interface OpcaoCategoria {
  rotulo: string;
  /** Chave de categoria de conta a pagar (src/lib/categorias.ts). */
  categoria: string;
}

export const OPCOES_CATEGORIA: readonly OpcaoCategoria[] = [
  { rotulo: "Compra de material", categoria: "custo_produtos" },
  { rotulo: "Pagamento de funcionário", categoria: "custo_funcionario" },
  { rotulo: "Aluguel de equipamento", categoria: "aluguel_equipamentos" },
  { rotulo: "Frete ou transporte", categoria: "fretes" },
  { rotulo: "Outro gasto", categoria: "outros_custos_despesas" },
];

export interface DadosComprovante {
  valor: number;
  /** AAAA-MM-DD */
  data: string;
  favorecido: string;
  descricao?: string;
  categoria?: string;
  rotuloCategoria?: string;
  projetos?: { id: string; nome: string }[];
}

/** "2", "2.", " opção 2 ", "2)" → 2. Fora de 1..max, ou qualquer outra coisa, devolve null. */
export function lerEscolha(texto: string | null | undefined, max: number): number | null {
  if (!texto || texto.length > 30) return null;
  const m = /^\s*(?:op[cç][aã]o\s*)?(\d{1,2})\s*[.)\-]?\s*$/i.exec(texto);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= max ? n : null;
}

export function ehCancelar(texto: string | null | undefined): boolean {
  return !!texto && /^\s*(cancelar|cancela|cancel)\s*[.!]?\s*$/i.test(texto);
}

const real = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBr = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

function lista(itens: readonly string[]): string {
  return itens.map((t, i) => `${i + 1}. ${t}`).join("\n");
}

export function textoPerguntaCategoria(d: DadosComprovante): string {
  return [
    `Recebi um comprovante de ${real(d.valor)} para ${d.favorecido}, de ${dataBr(d.data)}.`,
    "Do que se trata?",
    "",
    lista(OPCOES_CATEGORIA.map((o) => o.rotulo)),
    "",
    "Responda só com o número, ou CANCELAR.",
  ].join("\n");
}

export function textoPerguntaProjeto(projetos: readonly { nome: string }[]): string {
  return ["Para qual projeto?", "", lista(projetos.map((p) => p.nome)), "", "Responda só com o número, ou CANCELAR."].join("\n");
}

export function textoEscolhaInvalida(max: number): string {
  return `Não entendi. Responda com um número de 1 a ${max}, ou CANCELAR.`;
}

export function textoContaLancada(d: DadosComprovante & { projeto: string; baixada: boolean; link: string }): string {
  return [
    `Lançado: ${d.rotuloCategoria ?? "gasto"} de ${real(d.valor)} para ${d.favorecido}, no projeto ${d.projeto}.`,
    d.baixada ? "A conta já entrou como paga, com o comprovante anexado." : "A conta entrou em aberto, com o comprovante anexado: confira e dê baixa no app.",
    `Ver ou corrigir: ${d.link}`,
  ].join("\n");
}

export const TEXTOS_COMPROVANTE = {
  cancelado: "Cancelado. Nada foi lançado.",
  semProjeto: "Para lançar um comprovante é preciso ter um projeto cadastrado. Cadastre no app e envie o comprovante de novo.",
  semValor: "Não consegui ler o valor deste comprovante. Tente uma foto mais nítida ou lance pelo app.",
  expirado: "Essa pergunta expirou. Envie o comprovante de novo.",
} as const;

/** Descrição da conta: o que a IA leu, ou "Rótulo · favorecido". */
export function descricaoDaConta(d: DadosComprovante): string {
  const base = d.descricao?.trim() || `${d.rotuloCategoria ?? "Pagamento"} · ${d.favorecido}`;
  return base.slice(0, 500);
}
