"use client";

import { useEffect, useState } from "react";
import type { ContaFinanceira, Obra } from "@/types";
import { contasRepositorio, garantirDadosDeExemplo, obrasRepositorio } from "@/services/data";
import { useCatalogoCategorias } from "@/hooks/useCatalogo";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/layout/PageHeader";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { FluxoFinanceiroChart } from "@/components/dashboard/FluxoFinanceiroChart";
import { GastosCategoriaChart } from "@/components/dashboard/GastosCategoriaChart";
import { ProgressoObrasList } from "@/components/dashboard/ProgressoObrasList";
import { ContasProximasList } from "@/components/dashboard/ContasProximasList";
import { AtividadeRecenteList } from "@/components/dashboard/AtividadeRecenteList";
import { formatarMoeda } from "@/lib/formatadores";
import {
  atividadeRecente,
  contasProximas,
  fluxoFinanceiroUltimosMeses,
  gastosPorCategoria,
  progressoObras,
  somaNoMes,
  variacaoPercentual,
} from "@/lib/dashboardMetrics";

export default function DashboardPage() {
  const [obras, setObras] = useState<Obra[]>([]);
  const [contas, setContas] = useState<ContaFinanceira[]>([]);
  const [carregando, setCarregando] = useState(true);
  const categoriasCatalogo = useCatalogoCategorias("pagar");

  useEffect(() => {
    garantirDadosDeExemplo();
    void (async () => {
      const [listaObras, listaContas] = await Promise.all([obrasRepositorio.listar(), contasRepositorio.listar()]);
      setObras(listaObras);
      setContas(listaContas);
      setCarregando(false);
    })();
  }, []);

  if (carregando) return <p className="text-sm text-muted">Carregando…</p>;

  const contasPagar = contas.filter((c) => c.tipo === "pagar");
  const contasReceber = contas.filter((c) => c.tipo === "receber");

  const totalAPagarAberto = contasPagar.filter((c) => c.status === "em_aberto").reduce((s, c) => s + c.valor, 0);
  const totalAReceberAberto = contasReceber.filter((c) => c.status === "em_aberto").reduce((s, c) => s + c.valor, 0);

  const pagoEsteMes = somaNoMes(contasPagar, 0);
  const pagoMesAnterior = somaNoMes(contasPagar, 1);
  const recebidoEsteMes = somaNoMes(contasReceber, 0);
  const recebidoMesAnterior = somaNoMes(contasReceber, 1);

  const obrasAtivas = obras.filter((o) => o.status === "em_andamento");

  return (
    <div className="flex flex-col gap-5 animar-entrada">
      <PageHeader titulo="Dashboard" />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard rotulo="Total em aberto" valor={formatarMoeda(totalAPagarAberto + totalAReceberAberto)} />
        <KpiCard
          rotulo="Pago este mês"
          valor={formatarMoeda(pagoEsteMes)}
          variacao={variacaoPercentual(pagoEsteMes, pagoMesAnterior)}
        />
        <KpiCard
          rotulo="Recebido este mês"
          valor={formatarMoeda(recebidoEsteMes)}
          variacao={variacaoPercentual(recebidoEsteMes, recebidoMesAnterior)}
        />
        <KpiCard rotulo="Obras em andamento" valor={String(obrasAtivas.length)} subtitulo={`${obras.length} no total`} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="mb-2 font-medium">Fluxo financeiro</h2>
          <FluxoFinanceiroChart dados={fluxoFinanceiroUltimosMeses(contas)} />
        </Card>
        <Card>
          <h2 className="mb-2 font-medium">Gastos por categoria</h2>
          <GastosCategoriaChart dados={gastosPorCategoria(contasPagar, categoriasCatalogo.rotuloDe)} />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card>
          <h2 className="mb-3 font-medium">Obras em andamento</h2>
          <ProgressoObrasList itens={progressoObras(obras, contas)} />
        </Card>
        <Card>
          <h2 className="mb-3 font-medium">Contas próximas</h2>
          <ContasProximasList contas={contasProximas(contas)} />
        </Card>
        <Card>
          <h2 className="mb-3 font-medium">Atividade recente</h2>
          <AtividadeRecenteList itens={atividadeRecente(contas)} />
        </Card>
      </div>
    </div>
  );
}
