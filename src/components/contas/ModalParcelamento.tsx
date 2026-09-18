"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { adicionarMeses, formatarMoeda } from "@/lib/formatadores";

export interface ParcelaEditavel {
  valor: number;
  dataVencimento: string;
}

interface ModalParcelamentoProps {
  valorTotal: number;
  dataVencimentoInicial: string;
  parcelasIniciais?: ParcelaEditavel[];
  onFechar: () => void;
  onConfirmar: (parcelas: ParcelaEditavel[]) => void;
}

function gerarParcelas(valorTotal: number, dataInicial: string, quantidade: number): ParcelaEditavel[] {
  const valorParcela = Math.floor((valorTotal / quantidade) * 100) / 100;
  const parcelas: ParcelaEditavel[] = [];
  let somaParcial = 0;
  for (let i = 0; i < quantidade; i++) {
    const ultima = i === quantidade - 1;
    const valor = ultima ? Math.round((valorTotal - somaParcial) * 100) / 100 : valorParcela;
    somaParcial += valor;
    parcelas.push({ valor, dataVencimento: adicionarMeses(dataInicial, i) });
  }
  return parcelas;
}

export function ModalParcelamento({
  valorTotal,
  dataVencimentoInicial,
  parcelasIniciais,
  onFechar,
  onConfirmar,
}: ModalParcelamentoProps) {
  const [quantidade, setQuantidade] = useState(parcelasIniciais?.length ?? 2);
  const [parcelas, setParcelas] = useState<ParcelaEditavel[]>(
    parcelasIniciais && parcelasIniciais.length > 0
      ? parcelasIniciais
      : gerarParcelas(valorTotal, dataVencimentoInicial, quantidade),
  );

  useEffect(() => {
    setParcelas(gerarParcelas(valorTotal, dataVencimentoInicial, quantidade));
    // Regenera as parcelas quando a quantidade muda; edições manuais linha a
    // linha não devem ser sobrescritas por mudanças em valor/data originais.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quantidade]);

  function atualizarParcela(indice: number, campo: keyof ParcelaEditavel, valor: string) {
    setParcelas((atual) =>
      atual.map((p, i) => {
        if (i !== indice) return p;
        if (campo === "dataVencimento") return { ...p, dataVencimento: valor };
        return { ...p, valor: Number(valor) || 0 };
      }),
    );
  }

  const somaParcelas = parcelas.reduce((soma, p) => soma + p.valor, 0);
  const diferenca = Math.round((somaParcelas - valorTotal) * 100) / 100;

  return (
    <Modal titulo="Parcelamento" tamanho="lg" onFechar={onFechar}>
      <div className="flex flex-col gap-4">
        <Input
          label="Quantas parcelas?"
          type="number"
          min={2}
          max={36}
          value={String(quantidade)}
          onChange={(e) => setQuantidade(Math.max(2, Math.min(36, Number(e.target.value) || 2)))}
        />

        <div className="flex max-h-64 flex-col gap-3 overflow-y-auto pr-1">
          {parcelas.map((parcela, indice) => (
            <div key={indice} className="grid grid-cols-2 gap-2 border-t border-border pt-3 first:border-t-0 first:pt-0">
              <span className="col-span-2 text-xs font-medium text-muted">
                Parcela {indice + 1}/{parcelas.length}
              </span>
              <Input
                label="Valor (R$)"
                inputMode="decimal"
                value={String(parcela.valor)}
                onChange={(e) => atualizarParcela(indice, "valor", e.target.value)}
              />
              <Input
                label="Vencimento"
                type="date"
                value={parcela.dataVencimento}
                onChange={(e) => atualizarParcela(indice, "dataVencimento", e.target.value)}
              />
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted">Soma das parcelas</span>
          <span className={diferenca !== 0 ? "font-medium text-danger" : "font-medium text-success"}>
            {formatarMoeda(somaParcelas)}
            {diferenca !== 0 && ` (${diferenca > 0 ? "+" : ""}${formatarMoeda(diferenca)} vs. valor total)`}
          </span>
        </div>

        <div className="flex gap-3">
          <Button variante="outline" className="flex-1" onClick={onFechar}>
            Cancelar
          </Button>
          <Button className="flex-1" onClick={() => onConfirmar(parcelas)}>
            Confirmar parcelamento
          </Button>
        </div>
      </div>
    </Modal>
  );
}
