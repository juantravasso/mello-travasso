"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ProdutoNoDeposito } from "@/types";
import { useDeposito } from "@/hooks/useDeposito";
import { useObras } from "@/hooks/useObras";
import { useStatusPlano } from "@/components/layout/StatusPlanoContext";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { formatarData, formatarMoeda } from "@/lib/formatadores";
import { cn } from "@/lib/cn";
import { ModalTransferencia } from "./ModalTransferencia";

const quantidadeBr = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
const comUnidade = (n: number, unidade?: string) => (unidade ? `${quantidadeBr(n)} ${unidade}` : quantidadeBr(n));

type Aba = "produtos" | "historico";

export function DepositoVisao() {
  const { visao, transferencias, erro, carregando, transferir } = useDeposito();
  const { obras, locais } = useObras();
  const { somenteLeitura } = useStatusPlano();
  const [aba, setAba] = useState<Aba>("produtos");
  const [busca, setBusca] = useState("");
  const [soComSaldo, setSoComSaldo] = useState(true);
  const [transferindo, setTransferindo] = useState<ProdutoNoDeposito | null>(null);

  const nomeDoLocal = useMemo(() => new Map(locais.map((l) => [l.id, l.nome])), [locais]);

  const linhas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (visao?.produtos ?? []).filter((p) => {
      // Mostra também o que tem saldo só em projetos: dá para devolver ao depósito.
      if (soComSaldo && p.quantidade <= 0) return false;
      return termo === "" || p.nome.toLowerCase().includes(termo) || (p.categoria ?? "").toLowerCase().includes(termo);
    });
  }, [visao, busca, soComSaldo]);

  if (carregando && !visao) return <p className="text-sm text-muted">Carregando…</p>;
  if (erro || !visao) return <p className="text-sm text-danger">{erro ?? "Não foi possível abrir o Depósito."}</p>;

  return (
    <div className="flex flex-col gap-4">
      <Card className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Indicador rotulo="Valor em estoque" valor={formatarMoeda(visao.valorTotalEmEstoque)} ajuda="Ao valor da última compra de cada produto." />
        <Indicador rotulo="Produtos com saldo" valor={String(visao.totalProdutos)} />
        <Indicador
          rotulo="Sem valor de compra"
          valor={String(visao.semValor)}
          alerta={visao.semValor > 0}
          ajuda={visao.semValor > 0 ? "Transferir esses itens entra no projeto a R$ 0,00." : "Todos os itens têm valor conhecido."}
        />
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="inline-flex self-start rounded-lg border border-border bg-surface p-1">
          {(
            [
              ["produtos", "Produtos"],
              ["historico", `Transferências (${transferencias.length})`],
            ] as const
          ).map(([chave, rotulo]) => (
            <button
              key={chave}
              type="button"
              onClick={() => setAba(chave)}
              className={cn(
                "min-h-9 rounded-md px-4 text-sm font-medium transition-colors",
                aba === chave ? "bg-primary text-primary-foreground" : "text-muted hover:text-foreground",
              )}
            >
              {rotulo}
            </button>
          ))}
        </div>
        {aba === "produtos" && (
          <div className="flex flex-1 flex-col gap-2 sm:max-w-md sm:flex-row sm:items-end">
            <Input className="flex-1" label="Buscar produto" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Cimento, areia…" />
            <label className="flex min-h-11 cursor-pointer items-center gap-2 whitespace-nowrap text-sm text-muted">
              <input
                type="checkbox"
                checked={soComSaldo}
                onChange={(e) => setSoComSaldo(e.target.checked)}
                className="h-4 w-4 accent-[var(--color-primary)]"
              />
              Só com saldo no depósito
            </label>
          </div>
        )}
      </div>

      {aba === "produtos" ? (
        <ListaProdutos
          linhas={linhas}
          vazio={visao.produtos.length === 0}
          nomeDoLocal={nomeDoLocal}
          bloqueado={somenteLeitura}
          aoTransferir={setTransferindo}
        />
      ) : (
        <Historico transferencias={transferencias} nomeDoLocal={nomeDoLocal} />
      )}

      {transferindo && (
        <ModalTransferencia produto={transferindo} projetos={obras} onConfirmar={transferir} onFechar={() => setTransferindo(null)} />
      )}
    </div>
  );
}

function Indicador({ rotulo, valor, ajuda, alerta }: { rotulo: string; valor: string; ajuda?: string; alerta?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{rotulo}</p>
      <p className={cn("text-2xl font-semibold tabular-nums", alerta && "text-warning")}>{valor}</p>
      {ajuda && <p className="text-xs text-muted">{ajuda}</p>}
    </div>
  );
}

function ListaProdutos({
  linhas,
  vazio,
  nomeDoLocal,
  bloqueado,
  aoTransferir,
}: {
  linhas: ProdutoNoDeposito[];
  vazio: boolean;
  nomeDoLocal: Map<string, string>;
  bloqueado: boolean;
  aoTransferir: (p: ProdutoNoDeposito) => void;
}) {
  if (linhas.length === 0) {
    return (
      <Card className="flex flex-col gap-2 text-sm text-muted">
        {vazio ? (
          <>
            <p className="font-medium text-foreground">O Depósito ainda está vazio.</p>
            <p>
              Ao capturar uma nota fiscal, escolha &quot;Depósito&quot; como destino dos itens: eles entram aqui, sem virar gasto de
              projeto até serem transferidos.
            </p>
            <Link href="/capturar" className="font-medium text-primary underline">
              Capturar uma nota
            </Link>
          </>
        ) : (
          <p>Nenhum produto encontrado com esse filtro.</p>
        )}
      </Card>
    );
  }

  return (
    <>
      <Card className="hidden overflow-x-auto p-0 md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted">
              <th className="p-3 font-medium">Produto</th>
              <th className="p-3 text-right font-medium">No depósito</th>
              <th className="p-3 font-medium">Última compra</th>
              <th className="p-3 text-right font-medium">Valor em estoque</th>
              <th className="p-3 font-medium">Nos projetos</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {linhas.map((p) => (
              <tr key={p.produtoId} className="border-b border-border align-top transition-colors last:border-0 hover:bg-surface-2">
                <td className="p-3">
                  <Link href={`/estoque/${p.produtoId}`} className="font-medium text-foreground hover:text-primary">
                    {p.nome}
                  </Link>
                  {p.categoria && <p className="truncate text-xs text-muted">{p.categoria}</p>}
                </td>
                <td className="p-3 text-right">
                  <span className="font-medium tabular-nums">{comUnidade(p.quantidade, p.unidade)}</span>
                  {p.abaixoDoMinimo && (
                    <div className="mt-1">
                      <Badge tom="warning">Abaixo do mínimo</Badge>
                    </div>
                  )}
                </td>
                <td className="p-3">
                  <UltimaCompra produto={p} />
                </td>
                <td className="p-3 text-right font-medium tabular-nums">{formatarMoeda(p.valorEmEstoque)}</td>
                <td className="p-3">
                  <NosProjetos produto={p} nomeDoLocal={nomeDoLocal} />
                </td>
                <td className="p-3 text-right">
                  <Button
                    tamanho="sm"
                    variante="outline"
                    disabled={bloqueado}
                    title={bloqueado ? "Teste encerrado — os dados continuam disponíveis para consulta." : undefined}
                    onClick={() => aoTransferir(p)}
                  >
                    Transferir
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="flex flex-col gap-3 md:hidden">
        {linhas.map((p) => (
          <Card key={p.produtoId} className="flex flex-col gap-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link href={`/estoque/${p.produtoId}`} className="block truncate font-medium">
                  {p.nome}
                </Link>
                {p.categoria && <p className="truncate text-xs text-muted">{p.categoria}</p>}
              </div>
              <div className="flex-shrink-0 text-right">
                <p className="font-semibold tabular-nums">{comUnidade(p.quantidade, p.unidade)}</p>
                <p className="text-xs tabular-nums text-muted">{formatarMoeda(p.valorEmEstoque)}</p>
              </div>
            </div>
            {p.abaixoDoMinimo && <Badge tom="warning">Abaixo do mínimo</Badge>}
            <UltimaCompra produto={p} />
            <NosProjetos produto={p} nomeDoLocal={nomeDoLocal} />
            <Button tamanho="sm" variante="outline" disabled={bloqueado} onClick={() => aoTransferir(p)}>
              Transferir
            </Button>
          </Card>
        ))}
      </div>
    </>
  );
}

function UltimaCompra({ produto }: { produto: ProdutoNoDeposito }) {
  if (!produto.ultimaCompra) {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-muted">Sem compra registrada</span>
        {produto.origemDoValor === "custo_medio" && <span className="text-xs text-muted">Usa o custo médio: {formatarMoeda(produto.valorUnitario)}</span>}
        {produto.origemDoValor === "sem_valor" && <Badge tom="warning">Sem valor</Badge>}
      </div>
    );
  }
  const { valorUnitario, data, fornecedor } = produto.ultimaCompra;
  return (
    <div className="flex flex-col text-sm">
      <span className="font-medium tabular-nums">
        {formatarMoeda(valorUnitario)}
        {produto.unidade ? ` /${produto.unidade}` : ""}
      </span>
      <span className="text-xs text-muted">
        {formatarData(data)}
        {fornecedor ? ` · ${fornecedor}` : ""}
      </span>
    </div>
  );
}

function NosProjetos({ produto, nomeDoLocal }: { produto: ProdutoNoDeposito; nomeDoLocal: Map<string, string> }) {
  if (produto.nosProjetos.length === 0) return <span className="text-sm text-muted">Nenhum projeto</span>;
  return (
    <ul className="flex flex-col gap-0.5 text-xs">
      {produto.nosProjetos.map((s) => (
        <li key={s.obraId} className="flex justify-between gap-3 tabular-nums">
          <span className="truncate text-muted">{nomeDoLocal.get(s.obraId) ?? "Projeto"}</span>
          <span className="font-medium">{comUnidade(s.quantidade, produto.unidade)}</span>
        </li>
      ))}
    </ul>
  );
}

function Historico({
  transferencias,
  nomeDoLocal,
}: {
  transferencias: ReturnType<typeof useDeposito>["transferencias"];
  nomeDoLocal: Map<string, string>;
}) {
  if (transferencias.length === 0) {
    return <Card className="text-sm text-muted">Nenhuma transferência ainda. Use &quot;Transferir&quot; num produto para levar material a um projeto.</Card>;
  }
  return (
    <Card className="p-0">
      <ul className="flex flex-col">
        {transferencias.map((t) => (
          <li key={t.id} className="flex items-center justify-between gap-3 border-b border-border p-3 text-sm last:border-0">
            <div className="min-w-0">
              <p className="truncate font-medium">{t.produtoNome}</p>
              <p className="truncate text-xs text-muted">
                {t.sentido === "para_projeto" ? "Depósito → " : "Devolvido de "}
                {nomeDoLocal.get(t.obraId) ?? "projeto"} · {comUnidade(t.quantidade, t.unidade)} × {formatarMoeda(t.valorUnitario)} ·{" "}
                {formatarData(t.criadoEm)} · {t.lancadoPor}
              </p>
              {t.observacao && <p className="truncate text-xs text-muted">{t.observacao}</p>}
            </div>
            <span className={cn("flex-shrink-0 font-semibold tabular-nums", t.sentido === "devolucao" && "text-success")}>
              {t.sentido === "devolucao" ? "−" : ""}
              {formatarMoeda(t.custo)}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
