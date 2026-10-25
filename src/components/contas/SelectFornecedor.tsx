"use client";

import { useState } from "react";
import type { Fornecedor, NovoFornecedorInput } from "@/types";
import { mensagemDeErro } from "@/lib/mensagemErroAcao";
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
  /** Edita o cadastro do fornecedor escolhido. Sem isto o botão de editar não aparece. */
  onAtualizar?: (id: string, input: Partial<NovoFornecedorInput>) => Promise<Fornecedor>;
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
  onAtualizar,
  nomeSugerido,
}: SelectFornecedorProps) {
  const [editando, setEditando] = useState(false);
  const [edNome, setEdNome] = useState("");
  const [edDocumento, setEdDocumento] = useState("");
  const [edTelefone, setEdTelefone] = useState("");
  const [edEmail, setEdEmail] = useState("");
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [erroEdicao, setErroEdicao] = useState<string | null>(null);
  const escolhido = fornecedores.find((f) => f.id === fornecedorId);

  function abrirEdicao() {
    if (!escolhido) return;
    setEdNome(escolhido.nome);
    setEdDocumento(escolhido.documento ?? "");
    setEdTelefone(escolhido.telefone ?? "");
    setEdEmail(escolhido.email ?? "");
    setErroEdicao(null);
    setEditando(true);
  }

  async function salvarEdicao() {
    if (!escolhido || !onAtualizar || edNome.trim() === "") return;
    setSalvandoEdicao(true);
    setErroEdicao(null);
    try {
      const atualizado = await onAtualizar(escolhido.id, {
        nome: edNome.trim(),
        documento: edDocumento.replace(/\D/g, "") || undefined,
        telefone: edTelefone.trim() || undefined,
        email: edEmail.trim() || undefined,
      });
      onSelecionar(atualizado);
      setEditando(false);
    } catch (e) {
      setErroEdicao(mensagemDeErro(e));
    } finally {
      setSalvandoEdicao(false);
    }
  }
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

      {onAtualizar && escolhido && (
        <button type="button" onClick={abrirEdicao} className="-mt-1 w-fit text-xs font-medium text-primary underline underline-offset-2 hover:opacity-80 focus-visible:outline-2 focus-visible:outline-primary">
          Editar este fornecedor
        </button>
      )}

      {editando && (
        <Modal titulo="Editar fornecedor" onFechar={() => !salvandoEdicao && setEditando(false)}>
          <div className="flex flex-col gap-3">
            <Input label="Nome" value={edNome} onChange={(e) => setEdNome(e.target.value)} autoFocus />
            <Input label="CNPJ ou CPF (opcional)" inputMode="numeric" value={edDocumento} onChange={(e) => setEdDocumento(e.target.value)} />
            <Input label="Telefone (opcional)" value={edTelefone} onChange={(e) => setEdTelefone(e.target.value)} />
            <Input label="E-mail (opcional)" type="email" value={edEmail} onChange={(e) => setEdEmail(e.target.value)} />
            <p className="text-xs text-muted">Endereço e outros dados ficam em Cadastro → Fornecedores.</p>
            {erroEdicao && (
              <p role="alert" className="text-sm text-danger">
                {erroEdicao}
              </p>
            )}
            <Button onClick={() => void salvarEdicao()} disabled={edNome.trim() === "" || salvandoEdicao}>
              {salvandoEdicao ? "Salvando…" : "Salvar alterações"}
            </Button>
          </div>
        </Modal>
      )}

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
