"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/Textarea";

interface ModalCancelarContaProps {
  onFechar: () => void;
  onConfirmar: (motivo: string) => Promise<void>;
}

export function ModalCancelarConta({ onFechar, onConfirmar }: ModalCancelarContaProps) {
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function confirmar() {
    setEnviando(true);
    try {
      await onConfirmar(motivo.trim());
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal titulo="Cancelar lançamento" onFechar={onFechar}>
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted">
          Essa ação não pode ser desfeita. O lançamento fica marcado como cancelado e some dos totais.
        </p>
        <Textarea
          label="Motivo (opcional)"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Ex.: lançado em duplicidade"
        />
        <div className="flex gap-3">
          <Button variante="outline" className="flex-1" onClick={onFechar} disabled={enviando}>
            Voltar
          </Button>
          <Button variante="danger" className="flex-1" onClick={confirmar} disabled={enviando}>
            {enviando ? "Cancelando…" : "Confirmar cancelamento"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
