"use client";

import { useState } from "react";
import type { FiltrosFornecedor } from "@/types";
import { useFornecedores } from "@/hooks/useFornecedores";
import { FornecedorCard } from "./FornecedorCard";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

export function FornecedoresLista() {
  const [filtros, setFiltros] = useState<FiltrosFornecedor>({});
  const { fornecedores, carregando } = useFornecedores(filtros);

  return (
    <div>
      <Card className="mb-4">
        <Input
          label="Buscar"
          placeholder="Nome ou documento"
          value={filtros.busca ?? ""}
          onChange={(e) => setFiltros({ ...filtros, busca: e.target.value || undefined })}
        />
      </Card>

      {carregando && <p className="text-sm text-muted">Carregando…</p>}
      {!carregando && fornecedores.length === 0 && <p className="text-sm text-muted">Nenhum fornecedor encontrado.</p>}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {fornecedores.map((fornecedor) => (
          <FornecedorCard key={fornecedor.id} fornecedor={fornecedor} />
        ))}
      </div>
    </div>
  );
}
