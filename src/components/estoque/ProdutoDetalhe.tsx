"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useObras } from "@/hooks/useObras";
import { useProduto } from "@/hooks/useProduto";
import { useStatusPlano } from "@/components/layout/StatusPlanoContext";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { HistoricoMovimentos } from "./HistoricoMovimentos";
import { ModalMovimento } from "./ModalMovimento";

export function ProdutoDetalhe({ produtoId }: { produtoId: string }) {
  const { produto, movimentos, carregando, registrarMovimento } = useProduto(produtoId);
  const { obras } = useObras();
  const { somenteLeitura } = useStatusPlano();
  const [modalAberto, setModalAberto] = useState(false);

  const obraPorId = useMemo(() => new Map(obras.map((o) => [o.id, o])), [obras]);

  if (carregando) return <p className="text-sm text-muted">Carregando…</p>;
  if (!produto) return <p className="text-sm text-danger">Produto não encontrado.</p>;

  const abaixoDoMinimo = produto.estoqueMinimo != null && produto.saldoTotal < produto.estoqueMinimo;

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-2xl font-semibold tabular-nums">
            {produto.saldoTotal.toLocaleString("pt-BR", { maximumFractionDigits: 3 })}
            {produto.unidade ? ` ${produto.unidade}` : ""}
          </span>
          {abaixoDoMinimo && <Badge tom="warning">Abaixo do mínimo</Badge>}
        </div>
        {produto.sku && <DetalheLinha rotulo="SKU" valor={produto.sku} />}
        {produto.categoria && <DetalheLinha rotulo="Categoria" valor={produto.categoria} />}
        {produto.custoMedio != null && (
          <DetalheLinha
            rotulo="Custo médio"
            valor={produto.custoMedio.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          />
        )}
        {produto.estoqueMinimo != null && (
          <DetalheLinha rotulo="Estoque mínimo" valor={`${produto.estoqueMinimo}${produto.unidade ? ` ${produto.unidade}` : ""}`} />
        )}
        {produto.observacao && <DetalheLinha rotulo="Observação" valor={produto.observacao} />}
        <Link
          href={`/custos-produtos?descricao=${encodeURIComponent(produto.nome)}`}
          className="text-sm text-primary underline"
        >
          Ver histórico de preço
        </Link>
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="font-medium">Saldo por obra</h2>
        {produto.saldosPorObra.length === 0 && <p className="text-sm text-muted">Sem saldo em nenhuma obra ainda.</p>}
        <ul className="flex flex-col gap-2">
          {produto.saldosPorObra.map((saldo) => (
            <li key={saldo.obraId} className="flex items-center justify-between text-sm">
              <span className="text-muted">{obraPorId.get(saldo.obraId)?.nome ?? "Obra não encontrada"}</span>
              <span className="font-medium tabular-nums">
                {saldo.quantidade.toLocaleString("pt-BR", { maximumFractionDigits: 3 })}
                {produto.unidade ? ` ${produto.unidade}` : ""}
              </span>
            </li>
          ))}
        </ul>
        <Button
          variante="outline"
          onClick={() => setModalAberto(true)}
          disabled={somenteLeitura}
          title={somenteLeitura ? "Teste encerrado — os dados continuam disponíveis para consulta." : undefined}
        >
          + Nova movimentação
        </Button>
      </Card>

      <HistoricoMovimentos movimentos={movimentos} obraPorId={obraPorId} unidade={produto.unidade} />

      {modalAberto && (
        <ModalMovimento
          produtoId={produto.id}
          unidade={produto.unidade}
          obras={obras}
          saldosPorObra={produto.saldosPorObra}
          onFechar={() => setModalAberto(false)}
          onConfirmar={async (input) => {
            await registrarMovimento(input);
          }}
        />
      )}
    </div>
  );
}

function DetalheLinha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted">{rotulo}</span>
      <span className="text-right font-medium">{valor}</span>
    </div>
  );
}
