"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { ListaCompras, StatusCompra } from "@/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { useStatusPlano } from "@/components/layout/StatusPlanoContext";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { formatarData, formatarMoeda } from "@/lib/formatadores";
import { formatarNumeroCompra } from "@/lib/compras";
import { mensagemDeErro } from "@/lib/mensagemErroAcao";
import { comprasRepositorio } from "@/services/data";

const ROTULO_STATUS: Record<StatusCompra, { texto: string; tom: "success" | "warning" | "neutral" }> = {
  rascunho: { texto: "Rascunho", tom: "warning" },
  efetivada: { texto: "Efetivada", tom: "success" },
  cancelada: { texto: "Cancelada", tom: "neutral" },
};

/** Primeiro dia do mês passado: a lista abre mostrando o mês corrente e o anterior, sem varrer o histórico todo. */
function inicioPadrao(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 1, 1);
  return d.toISOString().slice(0, 10);
}

export default function ComprasPage() {
  const { somenteLeitura } = useStatusPlano();
  const aviso = useSearchParams().get("aviso");
  const [busca, setBusca] = useState("");
  const [de, setDe] = useState(inicioPadrao);
  const [ate, setAte] = useState("");
  const [status, setStatus] = useState<StatusCompra | "">("");
  const [lista, setLista] = useState<ListaCompras | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const r = await comprasRepositorio.listar({ busca: busca || undefined, de: de || undefined, ate: ate || undefined, status: status || undefined });
      if (r.ok) setLista(r.dados);
      else setErro(r.mensagem);
    } catch (e) {
      setErro(mensagemDeErro(e));
    }
  }, [busca, de, ate, status]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return (
    <div className="animar-entrada">
      <PageHeader
        titulo="Compras"
        acao={
          !somenteLeitura && (
            <div className="flex flex-wrap gap-2">
              <Link href="/compras/foto">
                <Button tamanho="sm" className="whitespace-nowrap">Lançar por foto</Button>
              </Link>
              <Link href="/compras/nova">
                <Button tamanho="sm" variante="outline" className="whitespace-nowrap">
                  + Lançar manualmente
                </Button>
              </Link>
            </div>
          )
        }
      />

      {aviso && <p role="status" className="mb-3 rounded-lg border border-warning bg-warning-bg px-3 py-2 text-sm text-warning">{aviso}</p>}

      <Card className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Input label="Fornecedor, NF ou nº" value={busca} onChange={(e) => setBusca(e.target.value)} className="" />
        <Input label="De" type="date" value={de} onChange={(e) => setDe(e.target.value)} />
        <Input label="Até" type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
        <Select label="Situação" value={status} onChange={(e) => setStatus(e.target.value as StatusCompra | "")}>
          <option value="">Todas</option>
          <option value="rascunho">Rascunho</option>
          <option value="efetivada">Efetivada</option>
          <option value="cancelada">Cancelada</option>
        </Select>
        <div className="flex items-end">
          <Button variante="outline" className="w-full" onClick={() => { setBusca(""); setDe(inicioPadrao()); setAte(""); setStatus(""); }}>
            Limpar filtros
          </Button>
        </div>
      </Card>

      {erro && <p role="alert" className="mb-3 text-sm text-danger">{erro}</p>}

      {!lista ? (
        <Card className="h-32 animate-pulse bg-surface-2" aria-busy="true">
          {null}
        </Card>
      ) : lista.compras.length === 0 ? (
        <Card className="flex flex-col items-start gap-2 text-sm">
          <p className="font-medium text-foreground">Nenhuma compra neste período.</p>
          <p className="text-muted">Fotografe a nota fiscal ou lance os itens à mão. Cada compra vira contas a pagar e entra no estoque ao ser efetivada.</p>
        </Card>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted">
                  <th className="px-3 py-2 font-medium">Nº</th>
                  <th className="px-3 py-2 font-medium">Data</th>
                  <th className="px-3 py-2 font-medium">Situação</th>
                  <th className="px-3 py-2 font-medium">NF</th>
                  <th className="px-3 py-2 font-medium">Fornecedor</th>
                  <th className="px-3 py-2 text-right font-medium">Valor</th>
                  <th className="px-3 py-2 text-right font-medium">Vencimentos</th>
                  <th className="px-3 py-2 font-medium">Produtos</th>
                </tr>
              </thead>
              <tbody>
                {lista.compras.map((c) => (
                  <tr key={c.id} className="border-b border-border last:border-0 hover:bg-surface-2">
                    <td className="px-3 py-2 tabular-nums">
                      <Link href={`/compras/${c.id}`} className="font-medium text-primary underline-offset-2 hover:underline">
                        {formatarNumeroCompra(c.numero)}
                      </Link>
                    </td>
                    <td className="px-3 py-2 tabular-nums">{formatarData(c.dataCompra)}</td>
                    <td className="px-3 py-2">
                      <Badge tom={ROTULO_STATUS[c.status].tom}>{ROTULO_STATUS[c.status].texto}</Badge>
                    </td>
                    <td className="px-3 py-2 tabular-nums">{c.numeroNf ?? "—"}</td>
                    <td className="max-w-[240px] truncate px-3 py-2" title={c.fornecedorNome}>
                      {c.fornecedorNome}
                      {c.origem === "foto" && <span className="ml-1 text-xs text-muted">(foto)</span>}
                    </td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">{formatarMoeda(c.valorTotal)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {c.status === "efetivada" ? (
                        <span title={`${formatarMoeda(c.vencimentosPagos)} pagos · ${formatarMoeda(c.vencimentosAbertos)} em aberto`}>
                          {c.vencimentosAbertos > 0 ? formatarMoeda(c.vencimentosAbertos) : "Pago"} <span className="text-muted">({c.parcelas}x)</span>
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {c.status === "efetivada" ? (
                        <Badge tom="success">Processado</Badge>
                      ) : c.status === "rascunho" ? (
                        <Badge tom={c.itensSemProduto > 0 ? "danger" : "info"}>
                          {c.itensSemProduto > 0 ? `${c.itensSemProduto} sem identificar` : "Pronto para efetivar"}
                        </Badge>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm tabular-nums md:grid-cols-4">
            <Resumo rotulo="Compras" valor={String(lista.totais.quantidade)} />
            <Resumo rotulo="Total em compras" valor={formatarMoeda(lista.totais.valorCompras)} />
            <Resumo rotulo="A pagar (em aberto)" valor={formatarMoeda(lista.totais.valorAberto)} />
            <Resumo rotulo="Já pago" valor={formatarMoeda(lista.totais.valorPago)} />
          </dl>
          {lista.compras.length >= 300 && <p className="mt-2 text-xs text-muted">Mostrando as 300 mais recentes. Use os filtros para achar as antigas.</p>}
        </>
      )}
    </div>
  );
}

function Resumo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <dt className="text-xs text-muted">{rotulo}</dt>
      <dd className="text-base font-semibold text-foreground">{valor}</dd>
    </div>
  );
}
