"use client";

import { useMemo, useState } from "react";
import type { FiltrosFuncionario, StatusFuncionario } from "@/types";
import { useFuncionarios } from "@/hooks/useFuncionarios";
import { useObras } from "@/hooks/useObras";
import { FuncionarioCard } from "./FuncionarioCard";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

export function FuncionariosLista() {
  const [filtros, setFiltros] = useState<FiltrosFuncionario>({});
  const { obras } = useObras();
  const { funcionarios, carregando } = useFuncionarios(filtros);

  const obraPorId = useMemo(() => new Map(obras.map((o) => [o.id, o])), [obras]);

  return (
    <div>
      <Card className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Input
          label="Buscar"
          placeholder="Nome ou cargo"
          value={filtros.busca ?? ""}
          onChange={(e) => setFiltros({ ...filtros, busca: e.target.value || undefined })}
        />
        <Select
          label="Projeto"
          value={filtros.obraId ?? ""}
          onChange={(e) => setFiltros({ ...filtros, obraId: e.target.value || undefined })}
        >
          <option value="">Todas</option>
          {obras.map((obra) => (
            <option key={obra.id} value={obra.id}>
              {obra.nome}
            </option>
          ))}
        </Select>
        <Select
          label="Status"
          value={filtros.status ?? ""}
          onChange={(e) => setFiltros({ ...filtros, status: (e.target.value as StatusFuncionario) || undefined })}
        >
          <option value="">Todos</option>
          <option value="ativo">Ativo</option>
          <option value="inativo">Inativo</option>
        </Select>
      </Card>

      {carregando && <p className="text-sm text-muted">Carregando…</p>}
      {!carregando && funcionarios.length === 0 && <p className="text-sm text-muted">Nenhum funcionário encontrado.</p>}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {funcionarios.map((funcionario) => (
          <FuncionarioCard key={funcionario.id} funcionario={funcionario} obra={obraPorId.get(funcionario.obraId ?? "")} />
        ))}
      </div>
    </div>
  );
}
