"use client";

import { useCallback, useEffect, useState } from "react";
import type { CargoItem } from "@/types";
import type { ModuloChave } from "@/lib/auth/modulos";
import { listarCargos, salvarCargo } from "@/services/data/server/cargosActions";
import { mensagemDeErro } from "@/lib/mensagemErroAcao";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { useAcesso } from "@/components/layout/AcessoContext";
import { SeletorModulos } from "@/components/layout/SeletorModulos";

const VALOR_NOVO = "__novo_cargo__";

/**
 * Cargo ou função do funcionário. O dono cria e edita cargos aqui mesmo; cada cargo guarda os módulos que vêm marcados
 * quando se dá acesso ao sistema a quem tem esse cargo (depois dá para ajustar pessoa a pessoa).
 */
export function SeletorCargo({ value, onChange }: { value: string; onChange: (nome: string, cargo: CargoItem | null) => void }) {
  const { pessoa } = useAcesso();
  const souDono = pessoa.papel === "dono";
  const [cargos, setCargos] = useState<CargoItem[]>([]);
  const [disponiveis, setDisponiveis] = useState<ModuloChave[]>([]);
  const [editando, setEditando] = useState<CargoItem | "novo" | null>(null);
  const [nome, setNome] = useState("");
  const [modulos, setModulos] = useState<ModuloChave[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const r = await listarCargos();
    if (r.ok) {
      setCargos(r.dados.cargos);
      setDisponiveis(r.dados.modulosDisponiveis);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const atual = cargos.find((c) => c.nome === value) ?? null;

  function abrir(alvo: CargoItem | "novo") {
    setErro(null);
    setNome(alvo === "novo" ? "" : alvo.nome);
    setModulos(alvo === "novo" ? [] : alvo.modulos);
    setEditando(alvo);
  }

  async function salvar() {
    if (!editando) return;
    setSalvando(true);
    setErro(null);
    try {
      const r = await salvarCargo({ id: editando === "novo" ? undefined : editando.id, nome, modulos });
      if (!r.ok) {
        setErro(r.mensagem);
        return;
      }
      await carregar();
      setEditando(null);
      onChange(r.dados.nome, r.dados);
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <Select
            label="Cargo/Função"
            value={value}
            onChange={(e) => {
              if (e.target.value === VALOR_NOVO) {
                abrir("novo");
                return;
              }
              onChange(e.target.value, cargos.find((c) => c.nome === e.target.value) ?? null);
            }}
          >
            <option value="" disabled>
              Selecione o cargo
            </option>
            {cargos.map((c) => (
              <option key={c.id} value={c.nome}>
                {c.nome}
              </option>
            ))}
            {value && !atual && <option value={value}>{value}</option>}
            {souDono && <option value={VALOR_NOVO}>+ Novo cargo…</option>}
          </Select>
        </div>
        {souDono && atual && (
          <Button type="button" variante="outline" tamanho="sm" onClick={() => abrir(atual)}>
            Editar cargo
          </Button>
        )}
      </div>

      {editando && (
        <Modal titulo={editando === "novo" ? "Novo cargo" : "Editar cargo"} tamanho="lg" onFechar={() => !salvando && setEditando(null)}>
          <div className="flex flex-col gap-3">
            <Input label="Nome do cargo ou função" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={80} autoFocus />
            <SeletorModulos disponiveis={disponiveis} selecionados={modulos} aoMudar={setModulos} desabilitado={salvando} />
            <p className="text-xs text-muted">
              Estes módulos vêm marcados quando você dá acesso ao sistema a alguém com este cargo. Depois você ajusta pessoa a pessoa, e mudar o cargo
              não altera o acesso de quem já foi cadastrado.
            </p>
            {erro && (
              <p role="alert" className="text-sm text-danger">
                {erro}
              </p>
            )}
            <Button type="button" onClick={() => void salvar()} disabled={salvando || nome.trim().length < 2}>
              {salvando ? "Salvando…" : "Salvar cargo"}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
