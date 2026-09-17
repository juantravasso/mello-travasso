"use client";

import { useState } from "react";
import type { OpcaoCatalogo } from "@/hooks/useCatalogo";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";

const VALOR_CRIAR_NOVA = "__criar_nova__";

interface SelectComCriacaoProps {
  label: string;
  value: string;
  onChange: (valor: string) => void;
  opcoes: OpcaoCatalogo[];
  onCriar: (rotulo: string) => Promise<string>;
  tituloModal: string;
  rotuloVazio: string;
  opcional?: boolean;
}

export function SelectComCriacao({
  label,
  value,
  onChange,
  opcoes,
  onCriar,
  tituloModal,
  rotuloVazio,
  opcional,
}: SelectComCriacaoProps) {
  const [modalAberto, setModalAberto] = useState(false);
  const [novoRotulo, setNovoRotulo] = useState("");
  const [criando, setCriando] = useState(false);

  function aoMudar(valorSelecionado: string) {
    if (valorSelecionado === VALOR_CRIAR_NOVA) {
      setNovoRotulo("");
      setModalAberto(true);
      return;
    }
    onChange(valorSelecionado);
  }

  async function confirmarCriacao() {
    if (novoRotulo.trim() === "") return;
    setCriando(true);
    try {
      const id = await onCriar(novoRotulo.trim());
      onChange(id);
      setModalAberto(false);
    } finally {
      setCriando(false);
    }
  }

  return (
    <>
      <Select label={label} value={value} onChange={(e) => aoMudar(e.target.value)}>
        <option value="">{opcional ? `${rotuloVazio}` : "Selecione"}</option>
        {opcoes.map((opcao) => (
          <option key={opcao.valor} value={opcao.valor}>
            {opcao.rotulo}
          </option>
        ))}
        <option value={VALOR_CRIAR_NOVA}>+ Criar nova opção…</option>
      </Select>

      {modalAberto && (
        <Modal titulo={tituloModal} onFechar={() => setModalAberto(false)}>
          <div className="flex flex-col gap-3">
            <Input
              label="Nome"
              value={novoRotulo}
              onChange={(e) => setNovoRotulo(e.target.value)}
              autoFocus
            />
            <Button onClick={confirmarCriacao} disabled={novoRotulo.trim() === "" || criando}>
              {criando ? "Salvando…" : "Salvar e usar"}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
