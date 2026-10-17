import Link from "next/link";
import type { ContaFinanceira, Obra } from "@/types";
import { Card } from "@/components/ui/Card";
import { PrecisaCompletarBadge } from "@/components/ui/PrecisaCompletarBadge";
import { StatusContaBadge } from "@/components/ui/StatusContaBadge";
import { lancadoPor } from "@/lib/autoria";
import { formatarData, formatarMoeda } from "@/lib/formatadores";

export function ContasTabela({
  contas,
  obraPorId,
}: {
  contas: ContaFinanceira[];
  obraPorId: Map<string, Obra>;
}) {
  return (
    <Card className="hidden overflow-x-auto p-0 md:block">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted">
            <th className="p-3 font-medium">Fornecedor/Cliente</th>
            <th className="p-3 font-medium">Projeto</th>
            <th className="p-3 font-medium">Lançado por</th>
            <th className="p-3 font-medium">Vencimento</th>
            <th className="p-3 font-medium text-right">Valor</th>
            <th className="p-3 font-medium">Status</th>
            <th className="w-10 p-3" aria-label="Ações" />
          </tr>
        </thead>
        <tbody>
          {contas.map((conta) => (
            <tr
              key={conta.id}
              className="border-b border-border transition-colors last:border-0 hover:bg-surface-2"
            >
              <td className="p-3">
                <Link
                  href={`/${conta.tipo === "pagar" ? "contas-a-pagar" : "contas-a-receber"}/${conta.id}`}
                  className="font-medium text-foreground hover:text-primary"
                >
                  {conta.favorecidoOuCliente}
                </Link>
                <p className="truncate text-xs text-muted">{conta.descricao}</p>
              </td>
              <td className="p-3 text-muted">
                {obraPorId.get(conta.obraId)?.nome ?? "—"}
                {conta.rateios && conta.rateios.length > 1 && (
                  <span className="ml-1 text-xs">
                    +{conta.rateios.length - 1}
                  </span>
                )}
              </td>
              <td className="p-3 text-muted">{lancadoPor(conta) ?? "—"}</td>
              <td className="p-3 text-muted">
                {formatarData(conta.dataVencimento)}
              </td>
              <td className="p-3 text-right font-medium">
                {formatarMoeda(conta.valor)}
              </td>
              <td className="p-3">
                <div className="flex flex-wrap gap-1.5">
                  <StatusContaBadge status={conta.status} tipo={conta.tipo} />
                  {conta.precisaCompletarCadastro && <PrecisaCompletarBadge />}
                </div>
              </td>
              <td className="p-3 text-right">
                <Link
                  href={`/${conta.tipo === "pagar" ? "contas-a-pagar" : "contas-a-receber"}/${conta.id}`}
                  className="text-muted hover:text-primary"
                  aria-label="Ver detalhe"
                >
                  ›
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
