"use client";

import { useMemo, useState } from "react";
import type { FiltrosContaFinanceira } from "@/types";
import { useContas } from "@/hooks/useContas";
import { useObras } from "@/hooks/useObras";
import { ContaForm } from "@/components/contas/ContaForm";
import { ContaListItem } from "@/components/contas/ContaListItem";
import { ContasTabela } from "@/components/contas/ContasTabela";
import { FiltrosContas } from "@/components/contas/FiltrosContas";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/layout/PageHeader";
import { formatarMoeda } from "@/lib/formatadores";

export default function ContasAPagarPage() {
  const [filtros, setFiltros] = useState<FiltrosContaFinanceira>({});
  const [mostrarForm, setMostrarForm] = useState(false);
  const { obras } = useObras();
  const { contas, carregando, criarConta } = useContas("pagar", filtros);

  const totalEmAberto = useMemo(
    () => contas.filter((c) => c.status === "em_aberto").reduce((soma, c) => soma + c.valor, 0),
    [contas],
  );

  const obraPorId = useMemo(() => new Map(obras.map((o) => [o.id, o])), [obras]);

  return (
    <div className="animar-entrada">
      <PageHeader
        titulo="Contas a Pagar"
        acao={
          <Button tamanho="sm" onClick={() => setMostrarForm((v) => !v)}>
            {mostrarForm ? "Fechar" : "+ Nova conta"}
          </Button>
        }
      />

      {mostrarForm && (
        <div className="mb-4">
          <ContaForm
            tipo="pagar"
            obras={obras}
            onCancelar={() => setMostrarForm(false)}
            onSalvar={async (input) => {
              await criarConta(input);
              setMostrarForm(false);
            }}
          />
        </div>
      )}

      <FiltrosContas filtros={filtros} onChange={setFiltros} obras={obras} />

      <p className="mb-3 text-sm text-muted">
        Em aberto no filtro atual: <span className="font-semibold text-foreground">{formatarMoeda(totalEmAberto)}</span>
      </p>

      {carregando && <p className="text-sm text-muted">Carregando…</p>}
      {!carregando && contas.length === 0 && <p className="text-sm text-muted">Nenhuma conta encontrada.</p>}

      <ContasTabela contas={contas} obraPorId={obraPorId} />

      <div className="flex flex-col gap-3 md:hidden">
        {contas.map((conta) => (
          <ContaListItem key={conta.id} conta={conta} obra={obraPorId.get(conta.obraId)} />
        ))}
      </div>
    </div>
  );
}
