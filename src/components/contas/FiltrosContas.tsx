"use client";

import type { FiltrosContaFinanceira, Obra, StatusConta } from "@/types";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

interface FiltrosContasProps {
  filtros: FiltrosContaFinanceira;
  onChange: (filtros: FiltrosContaFinanceira) => void;
  obras: Obra[];
}

const rotulosStatus: Record<StatusConta, string> = {
  em_aberto: "Em aberto",
  baixada: "Baixada",
  cancelada: "Cancelada",
};

export function FiltrosContas({ filtros, onChange, obras }: FiltrosContasProps) {
  return (
    <Card className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
      <Input
        label="Buscar"
        placeholder="Fornecedor, descrição..."
        value={filtros.busca ?? ""}
        onChange={(e) => onChange({ ...filtros, busca: e.target.value || undefined })}
      />
      <Select
        label="Obra"
        value={filtros.obraId ?? ""}
        onChange={(e) => onChange({ ...filtros, obraId: e.target.value || undefined })}
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
        onChange={(e) => onChange({ ...filtros, status: (e.target.value as StatusConta) || undefined })}
      >
        <option value="">Todos</option>
        {(Object.keys(rotulosStatus) as StatusConta[]).map((status) => (
          <option key={status} value={status}>
            {rotulosStatus[status]}
          </option>
        ))}
      </Select>
      <Input
        label="De"
        type="date"
        value={filtros.dataInicio ?? ""}
        onChange={(e) => onChange({ ...filtros, dataInicio: e.target.value || undefined })}
      />
      <Input
        label="Até"
        type="date"
        value={filtros.dataFim ?? ""}
        onChange={(e) => onChange({ ...filtros, dataFim: e.target.value || undefined })}
      />
      <label className="flex items-end gap-2 pb-2.5 text-sm text-foreground">
        <input
          type="checkbox"
          checked={filtros.precisaCompletarCadastro === true}
          onChange={(e) => onChange({ ...filtros, precisaCompletarCadastro: e.target.checked || undefined })}
        />
        Só pendentes de completar
      </label>
    </Card>
  );
}
