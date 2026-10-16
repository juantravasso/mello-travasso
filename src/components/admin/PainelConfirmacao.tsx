"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

/**
 * Passo final de uma ação de administração: motivo (opcional) e senha do admin.
 * O motivo vai para o registro interno; nunca é mostrado a quem sofre a ação.
 */
export function PainelConfirmacao({
  rotuloMotivo,
  rotuloBotao,
  perigo,
  ocupado,
  aoConfirmar,
  aoCancelar,
}: {
  /** Sem rótulo, a ação não pede motivo (ex.: desbloquear). */
  rotuloMotivo?: string;
  rotuloBotao: string;
  perigo?: boolean;
  ocupado: boolean;
  aoConfirmar: (motivo: string, senha: string) => void;
  aoCancelar: () => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [senha, setSenha] = useState("");
  const faltaMotivo = rotuloMotivo !== undefined && motivo.trim().length < 5;

  return (
    <div className="flex flex-col gap-2 border-t border-border pt-3">
      {rotuloMotivo !== undefined && (
        <Input label={rotuloMotivo} value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={500} autoFocus />
      )}
      <Input
        type="password"
        label="Confirme sua senha"
        autoComplete="current-password"
        value={senha}
        onChange={(e) => setSenha(e.target.value)}
        maxLength={200}
        autoFocus={rotuloMotivo === undefined}
      />
      <div className="flex gap-2">
        <Button
          type="button"
          tamanho="sm"
          variante={perigo ? "danger" : "primary"}
          disabled={ocupado || faltaMotivo || senha.length === 0}
          onClick={() => aoConfirmar(motivo, senha)}
        >
          {rotuloBotao}
        </Button>
        <Button type="button" tamanho="sm" variante="ghost" onClick={aoCancelar}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
