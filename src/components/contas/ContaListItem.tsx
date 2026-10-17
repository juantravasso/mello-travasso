import Link from "next/link";
import type { ContaFinanceira, Obra } from "@/types";
import { Card } from "@/components/ui/Card";
import { PrecisaCompletarBadge } from "@/components/ui/PrecisaCompletarBadge";
import { StatusContaBadge } from "@/components/ui/StatusContaBadge";
import { lancadoPor } from "@/lib/autoria";
import { formatarData, formatarMoeda } from "@/lib/formatadores";
import { valorDoDestino } from "@/lib/estoque/rateio";

/** `obraDoContexto`: ao listar dentro de um projeto, uma nota dividida mostra só a parte dele. */
export function ContaListItem({
  conta,
  obra,
  obraDoContexto,
}: {
  conta: ContaFinanceira;
  obra?: Obra;
  obraDoContexto?: string;
}) {
  const parte =
    obraDoContexto && conta.rateios
      ? valorDoDestino(conta, obraDoContexto)
      : undefined;
  return (
    <Link
      href={`/${conta.tipo === "pagar" ? "contas-a-pagar" : "contas-a-receber"}/${conta.id}`}
    >
      <Card className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">
            {conta.favorecidoOuCliente}
            {conta.parcela && (
              <span className="ml-1.5 text-xs font-normal text-muted">
                ({conta.parcela.numero}/{conta.parcela.totalParcelas})
              </span>
            )}
          </p>
          <p className="truncate text-sm text-muted">{conta.descricao}</p>
          {(obra || conta.rateios) && (
            <p className="truncate text-xs text-muted">
              {obra
                ? `${obra.nome}${conta.rateios && conta.rateios.length > 1 ? ` +${conta.rateios.length - 1}` : ""}`
                : `Nota dividida entre ${conta.rateios?.length} destinos`}
            </p>
          )}
          {lancadoPor(conta) && (
            <p className="truncate text-xs text-muted">
              Lançado por {lancadoPor(conta)}
            </p>
          )}
        </div>

        <div className="flex flex-shrink-0 flex-col items-end gap-1">
          <span className="font-semibold">
            {formatarMoeda(parte ?? conta.valor)}
          </span>
          {parte !== undefined && (
            <span className="text-xs text-muted">
              de {formatarMoeda(conta.valor)} na nota
            </span>
          )}
          <span className="text-xs text-muted">
            {formatarData(conta.dataVencimento)}
          </span>
          <StatusContaBadge status={conta.status} tipo={conta.tipo} />
          {conta.precisaCompletarCadastro && <PrecisaCompletarBadge />}
        </div>
      </Card>
    </Link>
  );
}
