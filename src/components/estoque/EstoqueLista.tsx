"use client";

import Link from "next/link";
import type { ProdutoComSaldo } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";

function abaixoDoMinimo(produto: ProdutoComSaldo): boolean {
  return produto.estoqueMinimo != null && produto.saldoTotal < produto.estoqueMinimo;
}

function formatarQuantidade(quantidade: number, unidade?: string): string {
  const numero = quantidade.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
  return unidade ? `${numero} ${unidade}` : numero;
}

function EsqueletoLinha() {
  return (
    <tr className="border-b border-border last:border-0">
      <td className="p-3">
        <div className="h-4 w-40 animate-pulse rounded bg-surface-2" />
      </td>
      <td className="p-3">
        <div className="h-4 w-24 animate-pulse rounded bg-surface-2" />
      </td>
      <td className="p-3 text-right">
        <div className="ml-auto h-4 w-16 animate-pulse rounded bg-surface-2" />
      </td>
    </tr>
  );
}

export function EstoqueLista({ produtos, carregando }: { produtos: ProdutoComSaldo[]; carregando: boolean }) {
  if (!carregando && produtos.length === 0) {
    return (
      <Card className="text-sm text-muted">
        Nenhum produto cadastrado ainda. Produtos aparecem aqui automaticamente quando você captura uma nota fiscal,
        ou você pode cadastrar um agora.
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
              <th className="p-3 font-medium">Categoria</th>
              <th className="p-3 font-medium text-right">Saldo total</th>
            </tr>
          </thead>
          <tbody>
            {carregando
              ? Array.from({ length: 4 }).map((_, i) => <EsqueletoLinha key={i} />)
              : produtos.map((produto) => (
                  <tr key={produto.id} className="border-b border-border transition-colors last:border-0 hover:bg-surface-2">
                    <td className="p-3">
                      <Link href={`/estoque/${produto.id}`} className="font-medium text-foreground hover:text-primary">
                        {produto.nome}
                      </Link>
                      {produto.sku && <p className="truncate text-xs text-muted">SKU {produto.sku}</p>}
                    </td>
                    <td className="p-3 text-muted">{produto.categoria ?? "—"}</td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {abaixoDoMinimo(produto) && <Badge tom="warning">Abaixo do mínimo</Badge>}
                        <span className="font-medium tabular-nums">{formatarQuantidade(produto.saldoTotal, produto.unidade)}</span>
                      </div>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </Card>

      <div className="flex flex-col gap-3 md:hidden">
        {carregando
          ? Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="h-16 animate-pulse bg-surface-2">
                {null}
              </Card>
            ))
          : produtos.map((produto) => (
              <Link key={produto.id} href={`/estoque/${produto.id}`}>
                <Card className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{produto.nome}</p>
                    <p className="truncate text-sm text-muted">{produto.categoria ?? "Sem categoria"}</p>
                  </div>
                  <div className="flex flex-shrink-0 flex-col items-end gap-1">
                    <span className="font-semibold tabular-nums">{formatarQuantidade(produto.saldoTotal, produto.unidade)}</span>
                    {abaixoDoMinimo(produto) && <Badge tom="warning">Abaixo do mínimo</Badge>}
                  </div>
                </Card>
              </Link>
            ))}
      </div>
    </>
  );
}
