import type { DadosExtraidosComprovante, EntradaCompra } from "@/types";

// Foto da nota pelo WhatsApp → RASCUNHO de compra. Puro e testável: recebe o que a IA leu e devolve a entrada de
// salvarCompra. Nunca efetiva: efetivar exige identificar os produtos do catálogo, o que a pessoa revisa no app.

export const MIMES_DE_FOTO = new Set(["image/jpeg", "image/png", "image/webp"]);
export const TAMANHO_MAX_FOTO_BYTES = 8 * 1024 * 1024;
export const FORNECEDOR_NAO_LIDO = "Fornecedor não identificado";

const arred2 = (v: number) => Math.round(v * 100) / 100;
const valido = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;

/**
 * Monta a compra em rascunho. Itens sem descrição são descartados; sem nenhum item legível, mas com valor total, vira
 * um item único "Compra conforme a nota" (a pessoa detalha no app). Sem item e sem valor, devolve null (nada a lançar).
 */
export function montarRascunhoDaFoto(dados: DadosExtraidosComprovante, opcoes: { destinoId: string; hoje: string; fotoDataUrl: string }): EntradaCompra | null {
  const itens = (dados.itens ?? [])
    .filter((i) => typeof i.descricao === "string" && i.descricao.trim().length > 0)
    .map((i) => {
      const quantidade = valido(i.quantidade) && i.quantidade > 0 ? i.quantidade : 1;
      const unitario = valido(i.valorUnitario) ? i.valorUnitario : valido(i.valorTotal) ? i.valorTotal / quantidade : 0;
      return {
        descricao: i.descricao!.trim().slice(0, 300),
        unidade: i.unidade?.trim().slice(0, 20) || undefined,
        quantidade,
        valorUnitario: arred2(unitario),
        desconto: 0,
        valorTotal: arred2(quantidade * unitario),
        obraId: opcoes.destinoId,
      };
    })
    .slice(0, 200);

  if (itens.length === 0) {
    if (!valido(dados.valor) || dados.valor <= 0) return null;
    itens.push({ descricao: "Compra conforme a nota (detalhar itens)", unidade: undefined, quantidade: 1, valorUnitario: arred2(dados.valor), desconto: 0, valorTotal: arred2(dados.valor), obraId: opcoes.destinoId });
  }

  const data = dados.data && /^\d{4}-\d{2}-\d{2}$/.test(dados.data) ? dados.data : undefined;
  return {
    origem: "foto",
    fornecedorNome: dados.favorecido?.trim().slice(0, 200) || FORNECEDOR_NAO_LIDO,
    dataEmissao: data,
    dataCompra: data ?? opcoes.hoje,
    obraId: opcoes.destinoId,
    categoria: dados.categoriaSugerida?.trim().slice(0, 100) || undefined,
    frete: 0,
    seguro: 0,
    outrasDespesas: 0,
    observacao: "Lançada pela foto enviada no WhatsApp. Confira os itens e os valores antes de efetivar.",
    comprovanteUrl: opcoes.fotoDataUrl,
    itens,
  };
}

const real = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export interface ResumoRascunho {
  numero: string;
  fornecedor: string;
  qtdItens: number;
  total: number;
  destino: string;
  identificados: number;
  link: string;
}

export function textoDoRascunho(r: ResumoRascunho): string {
  const faltam = r.qtdItens - r.identificados;
  return [
    `Compra ${r.numero} lançada como rascunho.`,
    `Fornecedor: ${r.fornecedor}`,
    `${r.qtdItens} ${r.qtdItens === 1 ? "item" : "itens"} · Total ${real(r.total)}`,
    `Destino: ${r.destino}`,
    "",
    faltam > 0
      ? `Falta identificar ${faltam} ${faltam === 1 ? "item" : "itens"} no seu estoque. Confira e efetive aqui: ${r.link}`
      : `Confira os valores e efetive aqui: ${r.link}`,
    "Nada entra nas contas nem no estoque até você efetivar.",
  ].join("\n");
}

export const RESPOSTAS_FOTO = {
  semAcesso: "Sua conta não tem acesso para lançar compras agora. Fale com o responsável pela empresa ou abra o Elo Negócios para ver o motivo.",
  somenteLeitura: "Sua empresa está em modo somente leitura (teste ou assinatura sem acesso ativo). Os dados seguem disponíveis no app.",
  limite: "Muitas notas lidas na última hora. Tente de novo mais tarde.",
  formato: "Por aqui eu leio foto da nota (JPG ou PNG) de até 8 MB. Para PDF ou XML, lance pelo app.",
  lendo: "Recebi a foto. Lendo a nota…",
  naoLeu: "Não consegui ler esta nota. Tente uma foto mais nítida, com a nota inteira e bem iluminada, ou lance pelo app.",
  falha: "Não consegui lançar esta nota agora. Tente de novo em alguns minutos.",
} as const;
