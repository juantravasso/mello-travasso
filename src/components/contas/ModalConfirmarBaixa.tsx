"use client";

import { useState } from "react";
import type { TipoConta } from "@/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { hojeISO } from "@/lib/formatadores";

interface ModalConfirmarBaixaProps {
  tipo: TipoConta;
  onFechar: () => void;
  onConfirmar: (dataBaixa: string) => Promise<void>;
}

export function ModalConfirmarBaixa({ tipo, onFechar, onConfirmar }: ModalConfirmarBaixaProps) {
  const [dataBaixa, setDataBaixa] = useState(hojeISO());
  const [enviando, setEnviando] = useState(false);
  const rotuloAcao = tipo === "pagar" ? "Sim, marcar como paga" : "Sim, marcar como recebida";

  async function confirmar() {
    setEnviando(true);
    try {
      await onConfirmar(dataBaixa);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal titulo="Cadastro completo — dar baixa?" onFechar={onFechar}>
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted">
          {tipo === "pagar"
            ? "Essa conta já foi paga? Se sim, informe a data para dar baixa agora."
            : "Esse valor já foi recebido? Se sim, informe a data para dar baixa agora."}
        </p>
        <Input label="Data" type="date" value={dataBaixa} onChange={(e) => setDataBaixa(e.target.value)} />
        <div className="flex gap-3">
          <Button variante="outline" className="flex-1" onClick={onFechar} disabled={enviando}>
            Agora não
          </Button>
          <Button className="flex-1" onClick={confirmar} disabled={enviando}>
            {enviando ? "Salvando…" : rotuloAcao}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
