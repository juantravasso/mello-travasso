"use client";

import { useMemo, useState } from "react";
import type { MotivoSugestao, ProdutoComSaldo, SugestaoProduto } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { mensagemDeErro } from "@/lib/mensagemErroAcao";

export interface ItemParaIdentificar {
  descricao: string;
  codigoFornecedor?: string;
  unidade?: string;
  quantidade: number;
  produtoId?: string;
}

interface IdentificarProdutosProps {
  itens: ItemParaIdentificar[];
  produtos: ProdutoComSaldo[];
  /** Como cada item casou com o catálogo (mesma ordem de `itens`); null = sem sugestão. */
  sugestoes: (SugestaoProduto | null)[];
  /** Roda a sugestão de novo (memória do fornecedor e nome) para os itens ainda sem produto. */
  onIdentificar: () => Promise<void>;
  /** Cadastra um produto novo com o nome e a unidade do item e devolve o id. */
  onCriarProduto: (nome: string, unidade?: string) => Promise<string>;
  onConfirmar: (produtoPorItem: (string | undefined)[]) => void;
  onFechar: () => void;
}

const ROTULO_MOTIVO: Record<MotivoSugestao, { texto: string; tom: "success" | "info" | "warning" }> = {
  vinculo: { texto: "Já identificado antes", tom: "success" },
  nome: { texto: "Mesmo nome", tom: "success" },
  parecido: { texto: "Parecido: confira", tom: "warning" },
};

/** De-para dos itens da nota para os produtos do sistema. Confirmar guarda o vínculo para as próximas compras. */
export function IdentificarProdutos({ itens, produtos, sugestoes, onIdentificar, onCriarProduto, onConfirmar, onFechar }: IdentificarProdutosProps) {
  const [escolhas, setEscolhas] = useState<(string | undefined)[]>(() => itens.map((i) => i.produtoId));
  const [ocupado, setOcupado] = useState<number | "todos" | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [criados, setCriados] = useState<ProdutoComSaldo[]>([]);

  const todosProdutos = useMemo(() => [...produtos, ...criados].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")), [produtos, criados]);
  const nomeDe = (id: string | undefined) => todosProdutos.find((p) => p.id === id)?.nome;
  const faltam = escolhas.filter((e) => !e).length;

  // Quando a sugestão chega (ou muda), o que ainda não tem escolha já vem preenchido com ela.
  const [vistas, setVistas] = useState<(SugestaoProduto | null)[]>([]);
  if (vistas !== sugestoes) {
    setVistas(sugestoes);
    setEscolhas((atual) => atual.map((e, i) => e ?? sugestoes[i]?.produtoId));
  }

  async function identificar() {
    setOcupado("todos");
    setErro(null);
    try {
      await onIdentificar();
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setOcupado(null);
    }
  }

  async function cadastrar(indice: number) {
    const item = itens[indice];
    if (!item) return;
    setOcupado(indice);
    setErro(null);
    try {
      const id = await onCriarProduto(item.descricao, item.unidade);
      // O produto novo ainda não está na lista que veio de fora; guarda aqui para o campo mostrar o nome.
      setCriados((atual) => [
        ...atual,
        { id, nome: item.descricao.trim(), unidade: item.unidade, saldoTotal: 0, criadoEm: "", atualizadoEm: "" } as ProdutoComSaldo,
      ]);
      setEscolhas((atual) => atual.map((e, i) => (i === indice ? id : e)));
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setOcupado(null);
    }
  }

  return (
    <Modal titulo="Identificar produtos" tamanho="lg" onFechar={onFechar}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted">
          Ligue cada item da nota a um produto do seu estoque. O vínculo fica guardado por fornecedor: na próxima compra o item já vem identificado.
        </p>

        <ul className="flex max-h-[55vh] flex-col gap-3 overflow-y-auto pr-1">
          {itens.map((item, i) => {
            const escolhido = escolhas[i];
            const sugestao = sugestoes[i];
            const veioDaSugestao = sugestao && sugestao.produtoId === escolhido ? sugestao : null;
            return (
              <li key={i} className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{item.descricao}</p>
                    <p className="text-xs text-muted tabular-nums">
                      {item.codigoFornecedor ? `Cód. ${item.codigoFornecedor} · ` : ""}
                      {item.quantidade} {item.unidade ?? ""}
                    </p>
                  </div>
                  {escolhido ? (
                    <Badge tom={veioDaSugestao ? ROTULO_MOTIVO[veioDaSugestao.motivo].tom : "success"}>
                      {veioDaSugestao ? ROTULO_MOTIVO[veioDaSugestao.motivo].texto : "Identificado"}
                    </Badge>
                  ) : (
                    <Badge tom="danger">Sem produto</Badge>
                  )}
                </div>
                <Select
                  label="Produto do sistema"
                  value={escolhido ?? ""}
                  onChange={(e) => setEscolhas((atual) => atual.map((x, j) => (j === i ? e.target.value || undefined : x)))}
                >
                  <option value="">Escolha um produto…</option>
                  {todosProdutos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </Select>
                {!escolhido && (
                  <div>
                    <Button variante="outline" tamanho="sm" disabled={ocupado !== null} onClick={() => void cadastrar(i)}>
                      {ocupado === i ? "Cadastrando…" : "Cadastrar como produto novo"}
                    </Button>
                  </div>
                )}
                {escolhido && nomeDe(escolhido) && nomeDe(escolhido) !== item.descricao.trim() && (
                  <p className="text-xs text-muted">Entra no estoque como: {nomeDe(escolhido)}</p>
                )}
              </li>
            );
          })}
        </ul>

        {erro && <p role="alert" className="text-sm text-danger">{erro}</p>}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted">{faltam === 0 ? "Todos os itens identificados." : `${faltam} item(ns) sem produto.`}</p>
          <div className="flex gap-2">
            <Button variante="outline" disabled={ocupado !== null || faltam === 0} onClick={() => void identificar()}>
              {ocupado === "todos" ? "Procurando…" : "Identificar automaticamente"}
            </Button>
            <Button onClick={() => onConfirmar(escolhas)} disabled={ocupado !== null}>
              Confirmar
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
