"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ContaFinanceira, Obra, TransferenciaDeposito } from "@/types";
import { contasRepositorio, depositoRepositorio, obrasRepositorio } from "@/services/data";
import { Card } from "@/components/ui/Card";
import { StatusObraBadge } from "@/components/ui/StatusObraBadge";
import { ContaListItem } from "@/components/contas/ContaListItem";
import { formatarData, formatarMoeda } from "@/lib/formatadores";
import { calcularResumoFinanceiro } from "@/lib/resumoFinanceiro";
import { contaTocaDestino } from "@/lib/estoque/rateio";

export function ObraDetalhe({ obraId }: { obraId: string }) {
  const [obra, setObra] = useState<Obra | null>(null);
  const [contas, setContas] = useState<ContaFinanceira[]>([]);
  const [transferencias, setTransferencias] = useState<TransferenciaDeposito[]>([]);
  const [totalMateriais, setTotalMateriais] = useState(0);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    void (async () => {
      setCarregando(true);
      const [obraEncontrada, contasDaObra, materiais, custos] = await Promise.all([
        obrasRepositorio.obterPorId(obraId),
        contasRepositorio.listar({ obraId }),
        // Quem não tem acesso ao Estoque/Projetos recebe um erro aqui: o projeto abre igual, sem a seção de materiais.
        depositoRepositorio.listarTransferencias({ obraId }),
        depositoRepositorio.obterCustosTransferidos(),
      ]);
      setObra(obraEncontrada);
      // O filtro do servidor traz toda nota que cita o projeto; aqui só ficam as que têm parte dele.
      setContas(contasDaObra.filter((c) => contaTocaDestino(c, obraId)));
      setTransferencias(materiais.ok ? materiais.dados : []);
      // O total vem do servidor (a lista acima é só as mais recentes): ida menos devoluções.
      setTotalMateriais(custos.ok ? (custos.dados[obraId] ?? 0) : 0);
      setCarregando(false);
    })();
  }, [obraId]);

  if (carregando) return <p className="text-sm text-muted">Carregando…</p>;
  if (!obra) return <p className="text-sm text-danger">Projeto não encontrado.</p>;

  if (obra.ehDeposito) {
    return (
      <Card className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{obra.nome}</h2>
        <p className="text-sm text-muted">
          O Depósito é o estoque central da empresa, não um projeto. Veja o que há nele, os valores das últimas compras e
          transfira material para os projetos.
        </p>
        <Link href="/estoque/deposito" className="text-sm font-medium text-primary underline">
          Abrir o Depósito
        </Link>
      </Card>
    );
  }

  const resumo = calcularResumoFinanceiro(obra, contas, totalMateriais);
  const contasPagar = contas.filter((c) => c.tipo === "pagar");
  const contasReceber = contas.filter((c) => c.tipo === "receber");
  const temMateriais = transferencias.length > 0;

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
        {temMateriais && <Resumo rotulo="Materiais do estoque" valor={resumo.totalMateriaisDoDeposito} />}
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
            <ContaListItem key={conta.id} conta={conta} obraDoContexto={obra.id} />
          ))}
        </div>
      </section>

      {temMateriais && (
        <section className="flex flex-col gap-2">
          <div>
            <h3 className="font-medium">Materiais vindos do depósito ({transferencias.length})</h3>
            <p className="text-sm text-muted">
              Cada material entra no custo do projeto pelo valor da última compra no momento da transferência.
            </p>
          </div>
          <ul className="flex flex-col rounded-xl border border-border bg-card">
            {transferencias.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 border-b border-border p-3 text-sm last:border-0">
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {t.sentido === "devolucao" ? "Devolvido: " : ""}
                    {t.produtoNome}
                  </p>
                  <p className="text-xs tabular-nums text-muted">
                    {t.quantidade} {t.unidade ?? "un"} × {formatarMoeda(t.valorUnitario)} · {formatarData(t.criadoEm)} · {t.lancadoPor}
                  </p>
                </div>
                <span className={`flex-shrink-0 font-semibold tabular-nums ${t.sentido === "devolucao" ? "text-success" : ""}`}>
                  {t.sentido === "devolucao" ? "−" : ""}
                  {formatarMoeda(t.custo)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

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
