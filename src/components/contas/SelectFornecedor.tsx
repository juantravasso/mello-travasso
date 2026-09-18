"use client";

import { useState } from "react";
import type { Fornecedor } from "@/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";

const VALOR_CRIAR_NOVO = "__criar_novo__";

interface SelectFornecedorProps {
  label: string;
  fornecedores: Fornecedor[];
  fornecedorId: string;
  onSelecionar: (fornecedor: Fornecedor) => void;
  onCriar: (nome: string) => Promise<Fornecedor>;
  /** Nome sugerido (ex.: extraído pela IA) para pré-preencher o cadastro rápido quando nenhum fornecedor bate. */
  nomeSugerido?: string;
}

/**
 * Dropdown de fornecedores com busca embutida (via Select, que já mostra
 * busca acima de 6 opções) e criação rápida — usado tanto no lançamento
 * manual quanto na revisão pós-câmera, quando a IA não identifica o
 * fornecedor no comprovante.
 */
export function SelectFornecedor({
  label,
  fornecedores,
  fornecedorId,
  onSelecionar,
  onCriar,
  nomeSugerido,
}: SelectFornecedorProps) {
  const [modalAberto, setModalAberto] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [criando, setCriando] = useState(false);

  function aoMudar(valor: string) {
    if (valor === VALOR_CRIAR_NOVO) {
      setNovoNome(nomeSugerido ?? "");
      setModalAberto(true);
      return;
    }
    const fornecedor = fornecedores.find((f) => f.id === valor);
    if (fornecedor) onSelecionar(fornecedor);
  }

  async function confirmarCriacao() {
    if (novoNome.trim() === "") return;
    setCriando(true);
    try {
      const novo = await onCriar(novoNome.trim());
      onSelecionar(novo);
      setModalAberto(false);
    } finally {
      setCriando(false);
    }
  }

  return (
    <>
      <Select label={label} value={fornecedorId} onChange={(e) => aoMudar(e.target.value)}>
        <option value="" disabled>
          Selecione o fornecedor
        </option>
        {fornecedores.map((fornecedor) => (
          <option key={fornecedor.id} value={fornecedor.id}>
            {fornecedor.nome}
          </option>
        ))}
        <option value={VALOR_CRIAR_NOVO}>+ Cadastrar novo fornecedor…</option>
      </Select>

      {modalAberto && (
        <Modal titulo="Novo fornecedor" onFechar={() => setModalAberto(false)}>
          <div className="flex flex-col gap-3">
            <Input label="Nome" value={novoNome} onChange={(e) => setNovoNome(e.target.value)} autoFocus />
            <p className="text-xs text-muted">
              Você pode completar telefone, documento e outros dados depois em Cadastro → Fornecedores.
            </p>
            <Button onClick={confirmarCriacao} disabled={novoNome.trim() === "" || criando}>
              {criando ? "Salvando…" : "Salvar e usar"}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
