"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { HistoricoPrecoProduto } from "@/types";
import { useItensProduto } from "@/hooks/useItensProduto";
import { useObras } from "@/hooks/useObras";
import { itensProdutoRepositorio } from "@/services/data";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/layout/PageHeader";
import { GraficoPreco } from "@/components/produtos/GraficoPreco";
import { formatarData, formatarMoeda } from "@/lib/formatadores";

export default function CustosProdutosPage() {
  const { descricoes } = useItensProduto();
  const { obras } = useObras();
  const searchParams = useSearchParams();
  const [busca, setBusca] = useState("");
  const [historico, setHistorico] = useState<HistoricoPrecoProduto | null>(null);
  const [buscando, setBuscando] = useState(false);

  const obraPorId = new Map(obras.map((o) => [o.id, o]));

  const buscar = useCallback(async (descricao: string) => {
    setBusca(descricao);
    if (descricao.trim() === "") {
      setHistorico(null);
      return;
    }
    setBuscando(true);
    setHistorico(await itensProdutoRepositorio.historicoPorDescricao(descricao));
    setBuscando(false);
  }, []);

  // Suporta abrir a busca já preenchida, ex.: link "ver histórico de preço"
  // a partir da ficha de um produto em /estoque/[id].
  useEffect(() => {
    const descricao = searchParams.get("descricao");
    if (descricao) void buscar(descricao);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  return (
    <div className="animar-entrada">
      <PageHeader titulo="Custo de Produtos" />

      <Card className="mb-4">
        <Input
          label="Buscar produto/material"
          list="descricoes-produto"
          placeholder="ex.: cimento, vergalhão 10mm"
          value={busca}
          onChange={(e) => void buscar(e.target.value)}
        />
        <datalist id="descricoes-produto">
          {descricoes.map((d) => (
            <option key={d} value={d} />
          ))}
        </datalist>
      </Card>

      {buscando && <p className="text-sm text-muted">Buscando…</p>}

      {!buscando && busca && !historico && (
        <p className="text-sm text-muted">Nenhuma compra encontrada para &quot;{busca}&quot;.</p>
      )}

      {historico && (
        <div className="flex flex-col gap-4">
          <Card className="grid grid-cols-3 gap-3 text-center text-sm">
            <div>
              <p className="text-muted">Menor preço</p>
              <p className="font-semibold">{formatarMoeda(historico.menorPreco)}</p>
            </div>
            <div>
              <p className="text-muted">Preço médio</p>
              <p className="font-semibold">{formatarMoeda(historico.precoMedio)}</p>
            </div>
            <div>
              <p className="text-muted">Maior preço</p>
              <p className="font-semibold">{formatarMoeda(historico.maiorPreco)}</p>
            </div>
          </Card>

          <Card>
            <GraficoPreco ocorrencias={historico.ocorrencias} />
          </Card>

          <Card className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted">
                  <th className="p-3 font-medium">Data</th>
                  <th className="p-3 font-medium">Obra</th>
                  <th className="p-3 font-medium">Fornecedor</th>
                  <th className="p-3 font-medium text-right">Qtd.</th>
                  <th className="p-3 font-medium text-right">Vlr. unit.</th>
                </tr>
              </thead>
              <tbody>
                {historico.ocorrencias.map((item) => (
                  <tr key={item.id} className="border-b border-border last:border-0">
                    <td className="p-3">{formatarData(item.dataCompra)}</td>
                    <td className="p-3">{obraPorId.get(item.obraId)?.nome ?? "—"}</td>
                    <td className="p-3">{item.fornecedor ?? "—"}</td>
                    <td className="p-3 text-right">
                      {item.quantidade} {item.unidade ?? ""}
                    </td>
                    <td className="p-3 text-right">{formatarMoeda(item.valorUnitario)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}
    </div>
  );
}
