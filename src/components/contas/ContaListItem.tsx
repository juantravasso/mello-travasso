import Link from "next/link";
import type { ContaFinanceira, Obra } from "@/types";
import { Card } from "@/components/ui/Card";
import { PrecisaCompletarBadge } from "@/components/ui/PrecisaCompletarBadge";
import { StatusContaBadge } from "@/components/ui/StatusContaBadge";
import { lancadoPor } from "@/lib/autoria";
import { formatarData, formatarMoeda } from "@/lib/formatadores";

export function ContaListItem({ conta, obra }: { conta: ContaFinanceira; obra?: Obra }) {
  return (
    <Link href={`/${conta.tipo === "pagar" ? "contas-a-pagar" : "contas-a-receber"}/${conta.id}`}>
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
          {obra && <p className="truncate text-xs text-muted">{obra.nome}</p>}
          {lancadoPor(conta) && <p className="truncate text-xs text-muted">Lançado por {lancadoPor(conta)}</p>}
        </div>

        <div className="flex flex-shrink-0 flex-col items-end gap-1">
          <span className="font-semibold">{formatarMoeda(conta.valor)}</span>
          <span className="text-xs text-muted">{formatarData(conta.dataVencimento)}</span>
          <StatusContaBadge status={conta.status} tipo={conta.tipo} />
          {conta.precisaCompletarCadastro && <PrecisaCompletarBadge />}
        </div>
      </Card>
    </Link>
  );
}
