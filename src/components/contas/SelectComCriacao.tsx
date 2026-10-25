"use client";

import { useState } from "react";
import type { OpcaoCatalogo } from "@/hooks/useCatalogo";
import { mensagemDeErro } from "@/lib/mensagemErroAcao";
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
  /** Renomeia uma opção criada pela empresa. Sem isto o botão de editar não aparece. */
  onRenomear?: (id: string, rotulo: string) => Promise<void>;
  tituloModal: string;
  rotuloVazio: string;
  opcional?: boolean;
}

/**
 * Lista de opções (categoria, forma de pagamento…) com um botão para criar uma nova e outro para editar as que a
 * empresa já criou. As opções padrão do sistema aparecem no gerenciador, mas não mudam.
 */
export function SelectComCriacao({
  label,
  value,
  onChange,
  opcoes,
  onCriar,
  onRenomear,
  tituloModal,
  rotuloVazio,
  opcional,
}: SelectComCriacaoProps) {
  const [modalAberto, setModalAberto] = useState(false);
  const [novoRotulo, setNovoRotulo] = useState("");
  const [criando, setCriando] = useState(false);
  const [gerenciando, setGerenciando] = useState(false);
  const [nomes, setNomes] = useState<Record<string, string>>({});
  const [salvandoId, setSalvandoId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

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

  function abrirGerenciador() {
    setErro(null);
    setNomes(Object.fromEntries(opcoes.filter((o) => o.personalizada).map((o) => [o.valor, o.rotulo])));
    setGerenciando(true);
  }

  async function salvarNome(id: string) {
    const rotulo = (nomes[id] ?? "").trim();
    if (rotulo === "" || !onRenomear) return;
    setSalvandoId(id);
    setErro(null);
    try {
      await onRenomear(id, rotulo);
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setSalvandoId(null);
    }
  }

  const proprias = opcoes.filter((o) => o.personalizada);
  const padrao = opcoes.filter((o) => !o.personalizada);

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
      {onRenomear && (
        <button
          type="button"
          onClick={abrirGerenciador}
          className="-mt-1 w-fit text-xs font-medium text-primary underline underline-offset-2 hover:opacity-80 focus-visible:outline-2 focus-visible:outline-primary"
        >
          Editar {label.replace(/\s*\(opcional\)\s*/i, "").toLowerCase()}
        </button>
      )}

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

      {gerenciando && (
        <Modal titulo={`Editar ${label.replace(/\s*\(opcional\)\s*/i, "").toLowerCase()}`} onFechar={() => setGerenciando(false)}>
          <div className="flex flex-col gap-4">
            {proprias.length === 0 ? (
              <p className="text-sm text-muted">Você ainda não criou nenhuma opção. Use “+ Criar nova opção…” na lista para adicionar.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {proprias.map((o) => (
                  <li key={o.valor} className="flex items-end gap-2">
                    <div className="min-w-0 flex-1">
                      <Input
                        label="Nome"
                        value={nomes[o.valor] ?? o.rotulo}
                        onChange={(e) => setNomes((n) => ({ ...n, [o.valor]: e.target.value }))}
                        maxLength={100}
                      />
                    </div>
                    <Button
                      type="button"
                      variante="outline"
                      onClick={() => void salvarNome(o.valor)}
                      disabled={salvandoId === o.valor || (nomes[o.valor] ?? o.rotulo).trim() === "" || (nomes[o.valor] ?? o.rotulo).trim() === o.rotulo}
                    >
                      {salvandoId === o.valor ? "Salvando…" : "Renomear"}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            {padrao.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Padrão do sistema (não mudam)</p>
                <p className="mt-1 text-sm text-muted">{padrao.map((o) => o.rotulo).join(" · ")}</p>
              </div>
            )}
            {erro && (
              <p role="alert" className="text-sm text-danger">
                {erro}
              </p>
            )}
            <Button type="button" variante="ghost" onClick={() => setGerenciando(false)}>
              Fechar
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
