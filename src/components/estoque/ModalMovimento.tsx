"use client";

import { useEffect, useMemo, useState } from "react";
import type { NovoMovimentoInput, Obra, SaldoPorObra, TipoMovimentoEstoque } from "@/types";
import { obterValorDeReferencia } from "@/services/data/server/depositoActions";
import { formatarMoeda } from "@/lib/formatadores";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";

const PREFIXO_SALDO_INSUFICIENTE = "SALDO_INSUFICIENTE:";
const PREFIXO_SALDO_MUDOU = "SALDO_MUDOU:";

interface ModalMovimentoProps {
  produtoId: string;
  unidade?: string;
  obras: Obra[];
  saldosPorObra: SaldoPorObra[];
  onFechar: () => void;
  onConfirmar: (input: NovoMovimentoInput) => Promise<void>;
}

export function ModalMovimento({ produtoId, unidade, obras, saldosPorObra, onFechar, onConfirmar }: ModalMovimentoProps) {
  const [obraId, setObraId] = useState("");
  const [tipo, setTipo] = useState<TipoMovimentoEstoque>("entrada");
  const [quantidade, setQuantidade] = useState("");
  const [valorUnitario, setValorUnitario] = useState("");
  const [observacao, setObservacao] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erroQuantidade, setErroQuantidade] = useState<string | undefined>(undefined);

  const [referencia, setReferencia] = useState<{ valor: number; origem: "ultima_compra" | "custo_medio" | "sem_valor" } | null | undefined>(undefined);

  // Entrada e saída valem pelo preço da última compra do produto; o servidor calcula de novo na hora de gravar.
  useEffect(() => {
    let cancelado = false;
    obterValorDeReferencia(produtoId)
      .then((r) => {
        if (!cancelado) setReferencia(r.ok ? r.dados : null);
      })
      .catch(() => {
        if (!cancelado) setReferencia(null);
      });
    return () => {
      cancelado = true;
    };
  }, [produtoId]);

  const nomeDaObra = obras.find((o) => o.id === obraId)?.nome;
  const onde = nomeDaObra ? (obras.find((o) => o.id === obraId)?.ehDeposito ? "no Depósito" : `no projeto ${nomeDaObra}`) : "no local escolhido";
  const saldoPorObraId = useMemo(() => new Map(saldosPorObra.map((s) => [s.obraId, s.quantidade])), [saldosPorObra]);
  const saldoAtualDaObra = obraId ? (saldoPorObraId.get(obraId) ?? 0) : undefined;

  const valido = obraId !== "" && quantidade.trim() !== "" && Number(quantidade) >= 0;

  async function confirmar() {
    if (!valido) return;
    setErroQuantidade(undefined);
    setEnviando(true);
    try {
      await onConfirmar({
        produtoId,
        obraId,
        tipo,
        quantidade: Number(quantidade),
        saldoEsperado: tipo === "ajuste" ? (saldoAtualDaObra ?? 0) : undefined,
        valorUnitario: tipo !== "ajuste" && valorUnitario ? Number(valorUnitario.replace(",", ".")) : undefined,
        observacao: observacao.trim() || undefined,
      });
      onFechar();
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : "";
      if (mensagem.startsWith(PREFIXO_SALDO_INSUFICIENTE)) {
        const restam = mensagem.slice(PREFIXO_SALDO_INSUFICIENTE.length);
        setErroQuantidade(`Saldo insuficiente neste projeto: restam ${restam}${unidade ? ` ${unidade}` : ""}.`);
      } else if (mensagem.startsWith(PREFIXO_SALDO_MUDOU)) {
        const atual = mensagem.slice(PREFIXO_SALDO_MUDOU.length);
        setErroQuantidade(
          `O saldo mudou enquanto você preenchia (agora está ${atual}${unidade ? ` ${unidade}` : ""}) — feche e abra de novo para conferir.`,
        );
      } else {
        setErroQuantidade("Não foi possível registrar a movimentação. Tente de novo.");
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal titulo="Nova movimentação" onFechar={onFechar}>
      <div className="flex flex-col gap-3">
        <Select label="Onde (projeto ou Depósito)" value={obraId} onChange={(e) => setObraId(e.target.value)}>
          <option value="" disabled>
            Selecione o projeto
          </option>
          {obras.map((o) => (
            <option key={o.id} value={o.id}>
              {o.ehDeposito ? "Depósito (estoque da empresa)" : o.nome}
            </option>
          ))}
        </Select>

        <Select label="Tipo de movimentação" value={tipo} onChange={(e) => setTipo(e.target.value as TipoMovimentoEstoque)}>
          <option value="entrada">Entrada: o produto chega {onde}</option>
          <option value="saida">Saída: o produto sai {onde}</option>
          <option value="ajuste">Ajuste: corrigir o saldo {onde} (contagem física)</option>
        </Select>
        {obraId && (
          <p className="text-xs text-muted">
            {tipo === "entrada" && `Soma ao estoque ${onde}.`}
            {tipo === "saida" && `Baixa do estoque ${onde}.`}
            {tipo === "ajuste" && `Define o saldo ${onde} como o valor contado.`}
          </p>
        )}

        <Input
          id="quantidade"
          label={tipo === "ajuste" ? "Saldo real (após a contagem)" : "Quantidade"}
          inputMode="decimal"
          value={quantidade}
          onChange={(e) => setQuantidade(e.target.value)}
          erro={erroQuantidade}
        />
        {tipo === "ajuste" && obraId && (
          <p className="text-xs text-muted">
            Saldo atual neste projeto: {(saldoAtualDaObra ?? 0).toLocaleString("pt-BR")}
            {unidade ? ` ${unidade}` : ""} → informe o saldo real.
          </p>
        )}

        {tipo !== "ajuste" && referencia && referencia.origem !== "sem_valor" && (
          <div className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm">
            <p className="text-foreground">
              Valor unitário: <strong className="tabular-nums">{formatarMoeda(referencia.valor)}</strong>
              {unidade ? ` por ${unidade}` : ""}
            </p>
            <p className="text-xs text-muted">
              {referencia.origem === "ultima_compra" ? "É o preço da última compra deste produto." : "Ainda não há compra registrada: usa o custo médio do estoque."}
              {tipo === "entrada" && " A entrada conta como gasto do projeto por esse valor."}
            </p>
          </div>
        )}
        {tipo !== "ajuste" && referencia !== undefined && (referencia === null || referencia.origem === "sem_valor") && (
          <Input
            label="Valor unitário (R$, opcional)"
            inputMode="decimal"
            value={valorUnitario}
            onChange={(e) => setValorUnitario(e.target.value)}
          />
        )}
        {tipo !== "ajuste" && (referencia === null || referencia?.origem === "sem_valor") && (
          <p className="text-xs text-muted">Este produto ainda não tem compra registrada. Sem valor, a movimentação não gera gasto no projeto.</p>
        )}

        <Textarea label="Observação (opcional)" value={observacao} onChange={(e) => setObservacao(e.target.value)} />

        <div className="flex gap-3 pt-2">
          <Button variante="outline" className="flex-1" onClick={onFechar} disabled={enviando}>
            Cancelar
          </Button>
          <Button className="flex-1" onClick={confirmar} disabled={!valido || enviando}>
            {enviando ? "Salvando…" : "Registrar movimentação"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
