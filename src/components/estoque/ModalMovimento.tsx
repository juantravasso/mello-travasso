"use client";

import { useMemo, useState } from "react";
import type { NovoMovimentoInput, Obra, SaldoPorObra, TipoMovimentoEstoque } from "@/types";
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
        valorUnitario: tipo === "entrada" && valorUnitario ? Number(valorUnitario) : undefined,
        observacao: observacao.trim() || undefined,
      });
      onFechar();
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : "";
      if (mensagem.startsWith(PREFIXO_SALDO_INSUFICIENTE)) {
        const restam = mensagem.slice(PREFIXO_SALDO_INSUFICIENTE.length);
        setErroQuantidade(`Saldo insuficiente nesta obra: restam ${restam}${unidade ? ` ${unidade}` : ""}.`);
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
        <Select label="Obra" value={obraId} onChange={(e) => setObraId(e.target.value)}>
          <option value="" disabled>
            Selecione a obra
          </option>
          {obras.map((o) => (
            <option key={o.id} value={o.id}>
              {o.nome}
            </option>
          ))}
        </Select>

        <Select label="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoMovimentoEstoque)}>
          <option value="entrada">Entrada</option>
          <option value="saida">Saída</option>
          <option value="ajuste">Ajuste (contagem física)</option>
        </Select>

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
            Saldo atual nesta obra: {(saldoAtualDaObra ?? 0).toLocaleString("pt-BR")}
            {unidade ? ` ${unidade}` : ""} → informe o saldo real.
          </p>
        )}

        {tipo === "entrada" && (
          <Input
            label="Valor unitário (R$, opcional)"
            inputMode="decimal"
            value={valorUnitario}
            onChange={(e) => setValorUnitario(e.target.value)}
          />
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
