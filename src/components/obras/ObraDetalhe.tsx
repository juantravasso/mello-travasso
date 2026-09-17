"use client";

import { useEffect, useState } from "react";
import type { ContaFinanceira, Obra } from "@/types";
import { contasRepositorio, obrasRepositorio } from "@/services/data";
import { Card } from "@/components/ui/Card";
import { StatusObraBadge } from "@/components/ui/StatusObraBadge";
import { ContaListItem } from "@/components/contas/ContaListItem";
import { formatarData, formatarMoeda } from "@/lib/formatadores";
import { calcularResumoFinanceiro } from "@/lib/resumoFinanceiro";

export function ObraDetalhe({ obraId }: { obraId: string }) {
  const [obra, setObra] = useState<Obra | null>(null);
  const [contas, setContas] = useState<ContaFinanceira[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    void (async () => {
      setCarregando(true);
      const [obraEncontrada, contasDaObra] = await Promise.all([
        obrasRepositorio.obterPorId(obraId),
        contasRepositorio.listar({ obraId }),
      ]);
      setObra(obraEncontrada);
      setContas(contasDaObra);
      setCarregando(false);
    })();
  }, [obraId]);

  if (carregando) return <p className="text-sm text-muted">Carregando…</p>;
  if (!obra) return <p className="text-sm text-danger">Obra não encontrada.</p>;

  const resumo = calcularResumoFinanceiro(obra, contas);
  const contasPagar = contas.filter((c) => c.tipo === "pagar");
  const contasReceber = contas.filter((c) => c.tipo === "receber");

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{obra.nome}</h2>
          <StatusObraBadge status={obra.status} />
        </div>
        <p className="text-sm text-muted">{obra.cliente}</p>
        {obra.endereco && <p className="text-sm text-muted">{obra.endereco}</p>}
        <p className="text-sm text-muted">Início em {formatarData(obra.dataInicio)}</p>
      </Card>

      <Card className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3 lg:grid-cols-6">
        <Resumo rotulo="Total pago" valor={resumo.totalPago} />
        <Resumo rotulo="Em aberto (a pagar)" valor={resumo.totalEmAberto} />
        <Resumo rotulo="Total recebido" valor={resumo.totalRecebido} />
        <Resumo rotulo="A receber" valor={resumo.totalAReceber} />
        {resumo.orcamentoPrevisto !== undefined && (
          <>
            <Resumo rotulo="Orçamento previsto" valor={resumo.orcamentoPrevisto} />
            <Resumo
              rotulo="Saldo do orçamento"
              valor={resumo.saldoOrcamento ?? 0}
              destaqueNegativo={(resumo.saldoOrcamento ?? 0) < 0}
            />
          </>
        )}
      </Card>

      <section className="flex flex-col gap-2">
        <h3 className="font-medium">Contas a pagar ({contasPagar.length})</h3>
        {contasPagar.length === 0 && <p className="text-sm text-muted">Nenhum gasto registrado ainda.</p>}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {contasPagar.map((conta) => (
            <ContaListItem key={conta.id} conta={conta} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="font-medium">Contas a receber ({contasReceber.length})</h3>
        {contasReceber.length === 0 && <p className="text-sm text-muted">Nenhum recebimento registrado ainda.</p>}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {contasReceber.map((conta) => (
            <ContaListItem key={conta.id} conta={conta} />
          ))}
        </div>
      </section>
    </div>
  );
}

function Resumo({ rotulo, valor, destaqueNegativo }: { rotulo: string; valor: number; destaqueNegativo?: boolean }) {
  return (
    <div>
      <p className="text-muted">{rotulo}</p>
      <p className={`font-semibold ${destaqueNegativo ? "text-danger" : ""}`}>{formatarMoeda(valor)}</p>
    </div>
  );
}
