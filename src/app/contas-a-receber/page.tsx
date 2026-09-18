"use client";

import { useMemo, useState } from "react";
import type { FiltrosContaFinanceira } from "@/types";
import { useContas } from "@/hooks/useContas";
import { useObras } from "@/hooks/useObras";
import { useUsuarioAtual } from "@/hooks/useUsuarioAtual";
import { ContaForm } from "@/components/contas/ContaForm";
import { ContaListItem } from "@/components/contas/ContaListItem";
import { ContasTabela } from "@/components/contas/ContasTabela";
import { FiltrosContas } from "@/components/contas/FiltrosContas";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/layout/PageHeader";
import { formatarMoeda } from "@/lib/formatadores";

export default function ContasAReceberPage() {
  const [filtros, setFiltros] = useState<FiltrosContaFinanceira>({ status: "em_aberto" });
  const [modalAberto, setModalAberto] = useState(false);
  const { obras } = useObras();
  const { contas, carregando, criarConta } = useContas("receber", filtros);
  const { usuarioOuPadrao } = useUsuarioAtual();

  const totalEmAberto = useMemo(
    () => contas.filter((c) => c.status === "em_aberto").reduce((soma, c) => soma + c.valor, 0),
    [contas],
  );

  const obraPorId = useMemo(() => new Map(obras.map((o) => [o.id, o])), [obras]);

  return (
    <div className="animar-entrada">
      <PageHeader
        titulo="Contas a Receber"
        acao={<Button tamanho="sm" onClick={() => setModalAberto(true)}>+ Nova conta</Button>}
      />

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

      {modalAberto && (
        <Modal titulo="Nova conta a receber" tamanho="lg" onFechar={() => setModalAberto(false)}>
          <ContaForm
            tipo="receber"
            obras={obras}
            onCancelar={() => setModalAberto(false)}
            onSalvar={async (inputs) => {
              for (const input of inputs) {
                await criarConta(input, usuarioOuPadrao);
              }
              setModalAberto(false);
            }}
          />
        </Modal>
      )}
    </div>
  );
}
