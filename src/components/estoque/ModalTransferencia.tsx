"use client";

import { useMemo, useState } from "react";
import type { NovaTransferenciaInput, Obra, ProdutoNoDeposito, SentidoTransferencia } from "@/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { custoDaTransferencia } from "@/lib/estoque/rateio";
import { formatarMoeda } from "@/lib/formatadores";
import { cn } from "@/lib/cn";

const quantidadeBr = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 3 });

interface ModalTransferenciaProps {
  produto: ProdutoNoDeposito;
  /** Só projetos: o Depósito é sempre a outra ponta. */
  projetos: Obra[];
  /** Devolve a mensagem de erro, ou null quando a transferência foi feita. */
  onConfirmar: (input: NovaTransferenciaInput) => Promise<string | null>;
  onFechar: () => void;
}

export function ModalTransferencia({ produto, projetos, onConfirmar, onFechar }: ModalTransferenciaProps) {
  const [sentido, setSentido] = useState<SentidoTransferencia>("para_projeto");
  const [obraId, setObraId] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [observacao, setObservacao] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const unidade = produto.unidade ? ` ${produto.unidade}` : "";
  const noProjeto = useMemo(() => new Map(produto.nosProjetos.map((s) => [s.obraId, s.quantidade])), [produto.nosProjetos]);
  const disponivel = sentido === "para_projeto" ? produto.quantidade : obraId ? (noProjeto.get(obraId) ?? 0) : 0;
  const unitario = produto.valorUnitario;
  const quantidadeNumero = Number(quantidade.replace(",", "."));
  const custo = quantidadeNumero > 0 ? custoDaTransferencia(quantidadeNumero, unitario) : 0;
  const valido = obraId !== "" && quantidadeNumero > 0 && quantidadeNumero <= disponivel;

  async function confirmar() {
    if (!valido) return;
    setEnviando(true);
    setErro(null);
    try {
      const mensagem = await onConfirmar({
        produtoId: produto.produtoId,
        obraId,
        sentido,
        quantidade: quantidadeNumero,
        observacao: observacao.trim() || undefined,
      });
      if (mensagem) setErro(mensagem);
      else onFechar();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal titulo={`Transferir: ${produto.nome}`} onFechar={onFechar}>
      <div className="flex flex-col gap-3">
        <div className="inline-flex rounded-lg border border-border bg-surface p-1">
          {(
            [
              ["para_projeto", "Depósito → projeto"],
              ["devolucao", "Devolver ao depósito"],
            ] as const
          ).map(([valor, rotulo]) => (
            <button
              key={valor}
              type="button"
              onClick={() => {
                setSentido(valor);
                setQuantidade("");
                setErro(null);
              }}
              className={cn(
                "min-h-9 flex-1 rounded-md px-3 text-sm font-medium transition-colors",
                sentido === valor ? "bg-primary text-primary-foreground" : "text-muted",
              )}
            >
              {rotulo}
            </button>
          ))}
        </div>

        <Select label={sentido === "para_projeto" ? "Projeto de destino" : "Projeto de origem"} value={obraId} onChange={(e) => setObraId(e.target.value)}>
          <option value="" disabled>
            Selecione o projeto
          </option>
          {projetos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
              {sentido === "devolucao" ? ` (${quantidadeBr(noProjeto.get(p.id) ?? 0)}${unidade})` : ""}
            </option>
          ))}
        </Select>

        <Input
          id="quantidade-transferencia"
          label={`Quantidade${produto.unidade ? ` (${produto.unidade})` : ""}`}
          inputMode="decimal"
          value={quantidade}
          onChange={(e) => setQuantidade(e.target.value)}
          erro={quantidadeNumero > disponivel ? `Só há ${quantidadeBr(disponivel)}${unidade} ${sentido === "para_projeto" ? "no depósito" : "neste projeto"}.` : undefined}
        />
        <p className="-mt-1 text-xs text-muted">
          Disponível {sentido === "para_projeto" ? "no depósito" : "no projeto"}: {quantidadeBr(disponivel)}
          {unidade}
        </p>

        <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface-2 p-3 text-sm">
          <p className="flex items-baseline justify-between gap-3 tabular-nums">
            <span className="text-muted">Valor da última compra</span>
            <span className="font-medium">{unitario > 0 ? `${formatarMoeda(unitario)}${unidade ? ` /${produto.unidade}` : ""}` : "—"}</span>
          </p>
          <p className="flex items-baseline justify-between gap-3 tabular-nums">
            <span className="text-muted">{sentido === "para_projeto" ? "Entra como gasto do projeto" : "Sai do gasto do projeto"}</span>
            <span className="text-base font-semibold">{formatarMoeda(custo)}</span>
          </p>
          {produto.origemDoValor === "custo_medio" && (
            <p className="text-xs text-warning">Este produto não tem compra registrada: o valor usado é o custo médio.</p>
          )}
          {produto.origemDoValor === "sem_valor" && (
            <p className="text-xs text-warning">
              Sem valor de compra conhecido: a transferência entra no projeto a R$ 0,00. Registre a compra por uma nota para o custo ficar certo.
            </p>
          )}
        </div>

        <Textarea label="Observação (opcional)" value={observacao} onChange={(e) => setObservacao(e.target.value)} />
        {erro && <p className="text-sm text-danger">{erro}</p>}

        <div className="flex gap-3 pt-1">
          <Button variante="outline" className="flex-1" onClick={onFechar} disabled={enviando}>
            Cancelar
          </Button>
          <Button className="flex-1" onClick={confirmar} disabled={!valido || enviando}>
            {enviando ? "Transferindo…" : sentido === "para_projeto" ? "Transferir" : "Devolver"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
