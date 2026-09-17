"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { StatusObra } from "@/types";
import { useObras } from "@/hooks/useObras";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { PageHeader } from "@/components/layout/PageHeader";
import { hojeISO } from "@/lib/formatadores";

export default function NovaObraPage() {
  const router = useRouter();
  const { criarObra } = useObras();
  const [nome, setNome] = useState("");
  const [cliente, setCliente] = useState("");
  const [endereco, setEndereco] = useState("");
  const [status, setStatus] = useState<StatusObra>("em_andamento");
  const [dataInicio, setDataInicio] = useState(hojeISO());
  const [orcamentoPrevisto, setOrcamentoPrevisto] = useState("");
  const [salvando, setSalvando] = useState(false);

  const valido = nome.trim() !== "" && cliente.trim() !== "";

  async function salvar() {
    if (!valido) return;
    setSalvando(true);
    try {
      const obra = await criarObra({
        nome: nome.trim(),
        cliente: cliente.trim(),
        endereco: endereco.trim() || undefined,
        status,
        dataInicio,
        orcamentoPrevisto: orcamentoPrevisto ? Number(orcamentoPrevisto) : undefined,
      });
      router.push(`/obras/${obra.id}`);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl animar-entrada">
      <PageHeader titulo="Nova obra" />
      <Card className="flex flex-col gap-3">
        <Input label="Nome da obra" value={nome} onChange={(e) => setNome(e.target.value)} />
        <Input label="Cliente" value={cliente} onChange={(e) => setCliente(e.target.value)} />
        <Input label="Endereço" value={endereco} onChange={(e) => setEndereco(e.target.value)} />
        <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value as StatusObra)}>
          <option value="em_andamento">Em andamento</option>
          <option value="pausada">Pausada</option>
          <option value="concluida">Concluída</option>
        </Select>
        <Input label="Data de início" type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
        <Input
          label="Orçamento previsto (R$, opcional)"
          inputMode="decimal"
          value={orcamentoPrevisto}
          onChange={(e) => setOrcamentoPrevisto(e.target.value)}
        />
        <div className="flex gap-3 pt-2">
          <Button variante="outline" className="flex-1" onClick={() => router.back()}>
            Cancelar
          </Button>
          <Button className="flex-1" onClick={salvar} disabled={!valido || salvando}>
            {salvando ? "Salvando…" : "Salvar obra"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
