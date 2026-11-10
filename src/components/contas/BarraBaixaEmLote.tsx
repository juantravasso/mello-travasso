"use client";

import { useState } from "react";
import type { TipoConta } from "@/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { formatarMoeda, hojeISO } from "@/lib/formatadores";
import { mensagemDeErro } from "@/lib/mensagemErroAcao";
import { contasRepositorio } from "@/services/data";

interface BarraBaixaEmLoteProps {
  tipo: TipoConta;
  ids: string[];
  total: number;
  onLimpar: () => void;
  /** Depois de baixar: recarrega a lista e limpa a seleção. */
  onConcluir: () => void | Promise<void>;
}

/** Barra fixa que aparece quando há contas marcadas, com a soma e a baixa de todas elas de uma vez. */
export function BarraBaixaEmLote({ tipo, ids, total, onLimpar, onConcluir }: BarraBaixaEmLoteProps) {
  const [aberto, setAberto] = useState(false);
  const [dataBaixa, setDataBaixa] = useState(hojeISO());
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const pagar = tipo === "pagar";
  const verbo = pagar ? "paga" : "recebida";
  const quantidade = ids.length;

  async function confirmar() {
    setEnviando(true);
    setErro(null);
    try {
      const r = await contasRepositorio.baixarEmLote({ contaIds: ids, dataBaixa });
      if (!r.ok) {
        setErro(r.mensagem);
        return;
      }
      setAberto(false);
      setAviso(
        r.dados.ignoradas > 0
          ? `${r.dados.baixadas} baixada(s). ${r.dados.ignoradas} já não estava(m) em aberto e ficou(aram) como estava(m).`
          : `${r.dados.baixadas} conta(s) marcada(s) como ${verbo}${r.dados.baixadas === 1 ? "" : "s"}.`,
      );
      await onConcluir();
      setTimeout(() => setAviso(null), 6000);
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      {aviso && (
        <p role="status" className="mb-3 rounded-lg border border-success bg-success-bg px-3 py-2 text-sm text-success">
          {aviso}
        </p>
      )}

      {quantidade > 0 && (
        <div
          role="region"
          aria-label="Contas selecionadas"
          className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/50 bg-card px-4 py-3 shadow-xl md:bottom-6"
        >
          <p className="text-sm text-foreground">
            <span className="font-semibold">{quantidade}</span> selecionada{quantidade === 1 ? "" : "s"} ·{" "}
            <span className="font-semibold tabular-nums">{formatarMoeda(total)}</span>
          </p>
          <div className="flex gap-2">
            <Button tamanho="sm" variante="ghost" onClick={onLimpar}>
              Limpar
            </Button>
            <Button
              tamanho="sm"
              onClick={() => {
                setErro(null);
                setAberto(true);
              }}
            >
              {pagar ? "Dar baixa nas selecionadas" : "Receber as selecionadas"}
            </Button>
          </div>
        </div>
      )}

      {aberto && (
        <Modal titulo={pagar ? "Dar baixa em várias contas" : "Receber várias contas"} onFechar={() => !enviando && setAberto(false)}>
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted">
              {quantidade} conta{quantidade === 1 ? "" : "s"}, somando <strong className="text-foreground tabular-nums">{formatarMoeda(total)}</strong>, serão marcadas como {verbo}
              {quantidade === 1 ? "" : "s"} na data abaixo.
            </p>
            <Input label={pagar ? "Data do pagamento" : "Data do recebimento"} type="date" value={dataBaixa} onChange={(e) => setDataBaixa(e.target.value)} />
            {erro && (
              <p role="alert" className="text-sm text-danger">
                {erro}
              </p>
            )}
            <div className="flex gap-3">
              <Button variante="outline" className="flex-1" onClick={() => setAberto(false)} disabled={enviando}>
                Voltar
              </Button>
              <Button className="flex-1" onClick={() => void confirmar()} disabled={enviando || !dataBaixa}>
                {enviando ? "Salvando…" : `Confirmar baixa de ${quantidade}`}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
