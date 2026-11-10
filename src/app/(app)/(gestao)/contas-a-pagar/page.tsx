"use client";

import { useMemo, useState } from "react";
import type { FiltrosContaFinanceira } from "@/types";
import { useContas } from "@/hooks/useContas";
import { useObras } from "@/hooks/useObras";
import { useSelecaoContas } from "@/hooks/useSelecaoContas";
import { BarraBaixaEmLote } from "@/components/contas/BarraBaixaEmLote";
import { ContaForm } from "@/components/contas/ContaForm";
import { ContaListItem } from "@/components/contas/ContaListItem";
import { ContasTabela } from "@/components/contas/ContasTabela";
import { FiltrosContas } from "@/components/contas/FiltrosContas";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/layout/PageHeader";
import { useStatusPlano } from "@/components/layout/StatusPlanoContext";
import { formatarMoeda } from "@/lib/formatadores";

export default function ContasAPagarPage() {
  const [filtros, setFiltros] = useState<FiltrosContaFinanceira>({ status: "em_aberto" });
  const [modalAberto, setModalAberto] = useState(false);
  const { obras, locais } = useObras();
  const { contas, carregando, criarConta, recarregar } = useContas("pagar", filtros);
  const selecao = useSelecaoContas(contas);
  const { somenteLeitura } = useStatusPlano();

  const totalEmAberto = useMemo(
    () => contas.filter((c) => c.status === "em_aberto").reduce((soma, c) => soma + c.valor, 0),
    [contas],
  );

  const obraPorId = useMemo(() => new Map(locais.map((o) => [o.id, o])), [locais]);

  return (
    <div className="animar-entrada">
      <PageHeader
        titulo="Contas a Pagar"
        acao={
          <Button
            tamanho="sm"
            onClick={() => setModalAberto(true)}
            disabled={somenteLeitura}
            title={somenteLeitura ? "Somente leitura: seu teste ou assinatura não está ativo. Os dados continuam disponíveis para consulta." : undefined}
          >
            + Nova conta
          </Button>
        }
      />

      <FiltrosContas tipo="pagar" filtros={filtros} onChange={setFiltros} obras={locais} />

      <p className="mb-3 text-sm text-muted">
        Em aberto no filtro atual: <span className="font-semibold text-foreground">{formatarMoeda(totalEmAberto)}</span>
      </p>

      {carregando && <p className="text-sm text-muted">Carregando…</p>}
      {!carregando && contas.length === 0 && <p className="text-sm text-muted">Nenhuma conta encontrada.</p>}

      <ContasTabela
        contas={contas}
        obraPorId={obraPorId}
        selecao={
          somenteLeitura
            ? undefined
            : { marcadas: selecao.marcadas, todasMarcadas: selecao.todasMarcadas, haSelecionaveis: selecao.selecionaveis.length > 0, alternar: selecao.alternar, alternarTodas: selecao.alternarTodas }
        }
      />

      <div className="flex flex-col gap-3 md:hidden">
        {contas.map((conta) => (
          <div key={conta.id} className="flex items-stretch gap-2">
            {!somenteLeitura && conta.status === "em_aberto" && (
              <label className="flex w-8 flex-shrink-0 cursor-pointer items-center justify-center">
                <input
                  type="checkbox"
                  aria-label={`Selecionar ${conta.favorecidoOuCliente}`}
                  checked={selecao.marcadas.has(conta.id)}
                  onChange={() => selecao.alternar(conta.id)}
                  className="h-5 w-5"
                />
              </label>
            )}
            <div className="min-w-0 flex-1">
              <ContaListItem conta={conta} obra={obraPorId.get(conta.obraId)} />
            </div>
          </div>
        ))}
      </div>

      <BarraBaixaEmLote
        tipo="pagar"
        ids={selecao.selecionadas.map((c) => c.id)}
        total={selecao.total}
        onLimpar={selecao.limpar}
        onConcluir={async () => {
          selecao.limpar();
          await recarregar();
        }}
      />

      {modalAberto && (
        <Modal titulo="Nova conta a pagar" tamanho="lg" onFechar={() => setModalAberto(false)}>
          <ContaForm
            tipo="pagar"
            obras={obras}
            onCancelar={() => setModalAberto(false)}
            onSalvar={async (inputs) => {
              for (const input of inputs) {
                await criarConta(input);
              }
              setModalAberto(false);
            }}
          />
        </Modal>
      )}
    </div>
  );
}
