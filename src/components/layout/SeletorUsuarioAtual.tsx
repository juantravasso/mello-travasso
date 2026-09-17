"use client";

import { useState } from "react";
import { useUsuarioAtual } from "@/hooks/useUsuarioAtual";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";

export function SeletorUsuarioAtual({ compacto }: { compacto?: boolean }) {
  const { usuario, definirUsuario } = useUsuarioAtual();
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState(usuario);

  function salvar() {
    definirUsuario(nome);
    setAberto(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setNome(usuario);
          setAberto(true);
        }}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
      >
        <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary">
          {(usuario || "?").slice(0, 1).toUpperCase()}
        </span>
        {!compacto && <span className="truncate">{usuario || "Definir seu nome"}</span>}
      </button>

      {aberto && (
        <Modal titulo="Quem é você?" onFechar={() => setAberto(false)}>
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted">
              Usado para registrar quem criou, baixou ou cancelou cada lançamento.
            </p>
            <Input
              label="Seu nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Márcio"
              autoFocus
            />
            <Button onClick={salvar} disabled={nome.trim() === ""}>
              Salvar
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
