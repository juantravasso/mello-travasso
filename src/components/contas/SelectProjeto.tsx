"use client";

import { useState } from "react";
import type { NovaObraInput, Obra, StatusObra } from "@/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { hojeISO } from "@/lib/formatadores";
import { mensagemDeErro } from "@/lib/mensagemErroAcao";

const VALOR_NOVO_PROJETO = "__novo_projeto__";

interface SelectProjetoProps {
  label: string;
  value: string;
  onChange: (obraId: string) => void;
  /** Projetos (e, para nota fiscal, o Depósito) que podem ser escolhidos. */
  opcoes: Obra[];
  criarObra: (input: NovaObraInput) => Promise<Obra>;
  /** Edita o projeto escolhido. Sem isto o botão de editar não aparece. */
  atualizarObra?: (id: string, input: Partial<NovaObraInput>) => Promise<Obra>;
  disabled?: boolean;
  /** Primeira opção, sem valor (ex.: "Selecione o projeto" ou "Igual ao geral"). */
  rotuloVazio: string;
  /** A opção vazia pode ser escolhida (destino por item: "igual ao geral"); no destino geral ela é só um aviso. */
  vazioEscolhivel?: boolean;
  className?: string;
}

/** Escolha de destino/projeto com a opção de criar um projeto ali mesmo, sem sair da tela. */
export function SelectProjeto({ label, value, onChange, opcoes, criarObra, atualizarObra, disabled, rotuloVazio, vazioEscolhivel, className }: SelectProjetoProps) {
  const [editando, setEditando] = useState(false);
  const [edNome, setEdNome] = useState("");
  const [edCliente, setEdCliente] = useState("");
  const [edEndereco, setEdEndereco] = useState("");
  const [edStatus, setEdStatus] = useState<StatusObra>("em_andamento");
  const [edOrcamento, setEdOrcamento] = useState("");
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [erroEdicao, setErroEdicao] = useState<string | null>(null);
  const escolhida = opcoes.find((o) => o.id === value && !o.ehDeposito);

  function abrirEdicao() {
    if (!escolhida) return;
    setEdNome(escolhida.nome);
    setEdCliente(escolhida.cliente);
    setEdEndereco(escolhida.endereco ?? "");
    setEdStatus(escolhida.status);
    setEdOrcamento(escolhida.orcamentoPrevisto !== undefined ? String(escolhida.orcamentoPrevisto) : "");
    setErroEdicao(null);
    setEditando(true);
  }

  async function salvarEdicao() {
    if (!escolhida || !atualizarObra || edNome.trim() === "" || edCliente.trim() === "") return;
    setSalvandoEdicao(true);
    setErroEdicao(null);
    try {
      const orcamento = Number(edOrcamento.replace(",", "."));
      await atualizarObra(escolhida.id, {
        nome: edNome.trim(),
        cliente: edCliente.trim(),
        endereco: edEndereco.trim() || undefined,
        status: edStatus,
        orcamentoPrevisto: orcamento > 0 ? orcamento : undefined,
      });
      setEditando(false);
    } catch (e) {
      setErroEdicao(mensagemDeErro(e));
    } finally {
      setSalvandoEdicao(false);
    }
  }
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [cliente, setCliente] = useState("");
  const [orcamento, setOrcamento] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function aoMudar(novo: string) {
    if (novo === VALOR_NOVO_PROJETO) {
      setNome("");
      setCliente("");
      setOrcamento("");
      setErro(null);
      setAberto(true);
      return;
    }
    onChange(novo);
  }

  const valido = nome.trim() !== "" && cliente.trim() !== "";

  async function salvar() {
    if (!valido) return;
    setSalvando(true);
    setErro(null);
    try {
      const orcamentoNumerico = Number(orcamento.replace(",", "."));
      const obra = await criarObra({
        nome: nome.trim(),
        cliente: cliente.trim(),
        status: "em_andamento",
        dataInicio: hojeISO(),
        orcamentoPrevisto: orcamentoNumerico > 0 ? orcamentoNumerico : undefined,
      });
      onChange(obra.id);
      setAberto(false);
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <Select label={label} value={value} onChange={(e) => aoMudar(e.target.value)} className={className} disabled={disabled}>
        <option value="" disabled={!vazioEscolhivel}>
          {rotuloVazio}
        </option>
        {opcoes.map((obra) => (
          <option key={obra.id} value={obra.id}>
            {obra.ehDeposito ? "Depósito (estoque da empresa)" : obra.nome}
          </option>
        ))}
        <option value={VALOR_NOVO_PROJETO}>+ Novo projeto…</option>
      </Select>

      {atualizarObra && escolhida && !disabled && (
        <button type="button" onClick={abrirEdicao} className="-mt-1 w-fit text-xs font-medium text-primary underline underline-offset-2 hover:opacity-80 focus-visible:outline-2 focus-visible:outline-primary">
          Editar este projeto
        </button>
      )}

      {editando && (
        <Modal titulo="Editar projeto" onFechar={() => !salvandoEdicao && setEditando(false)}>
          <div className="flex flex-col gap-3">
            <Input label="Nome do projeto" value={edNome} onChange={(e) => setEdNome(e.target.value)} autoFocus />
            <Input label="Cliente" value={edCliente} onChange={(e) => setEdCliente(e.target.value)} />
            <Input label="Endereço (opcional)" value={edEndereco} onChange={(e) => setEdEndereco(e.target.value)} />
            <Select label="Status" value={edStatus} onChange={(e) => setEdStatus(e.target.value as StatusObra)}>
              <option value="em_andamento">Em andamento</option>
              <option value="pausada">Pausada</option>
              <option value="concluida">Concluída</option>
            </Select>
            <Input label="Orçamento previsto (R$, opcional)" inputMode="decimal" value={edOrcamento} onChange={(e) => setEdOrcamento(e.target.value)} />
            {erroEdicao && (
              <p role="alert" className="text-sm text-danger">
                {erroEdicao}
              </p>
            )}
            <Button onClick={() => void salvarEdicao()} disabled={edNome.trim() === "" || edCliente.trim() === "" || salvandoEdicao}>
              {salvandoEdicao ? "Salvando…" : "Salvar alterações"}
            </Button>
          </div>
        </Modal>
      )}

      {aberto && (
        <Modal titulo="Novo projeto" onFechar={() => setAberto(false)}>
          <div className="flex flex-col gap-3">
            <Input label="Nome do projeto" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
            <Input label="Cliente" value={cliente} onChange={(e) => setCliente(e.target.value)} />
            <Input label="Orçamento previsto (R$, opcional)" inputMode="decimal" value={orcamento} onChange={(e) => setOrcamento(e.target.value)} />
            <p className="text-xs text-muted">O projeto começa hoje, em andamento. Endereço e outros detalhes você completa depois em Projetos.</p>
            {erro && (
              <p role="alert" className="text-sm text-danger">
                {erro}
              </p>
            )}
            <Button onClick={() => void salvar()} disabled={!valido || salvando}>
              {salvando ? "Salvando…" : "Criar e usar"}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
