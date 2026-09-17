import Link from "next/link";
import type { ContaFinanceira } from "@/types";
import { formatarData, formatarMoeda, hojeISO } from "@/lib/formatadores";

export function ContasProximasList({ contas }: { contas: ContaFinanceira[] }) {
  if (contas.length === 0) return <p className="text-sm text-muted">Nenhuma conta vencendo nos próximos dias.</p>;

  const hoje = hojeISO();

  return (
    <ul className="flex flex-col gap-3">
      {contas.map((conta) => {
        const vencendoHoje = conta.dataVencimento === hoje;
        return (
          <li key={conta.id}>
            <Link
              href={`/${conta.tipo === "pagar" ? "contas-a-pagar" : "contas-a-receber"}/${conta.id}`}
              className="flex items-center justify-between gap-3 text-sm hover:text-primary"
            >
              <span className="flex items-center gap-2 truncate">
                <span className={`h-2 w-2 flex-shrink-0 rounded-full ${vencendoHoje ? "bg-danger" : "bg-warning"}`} />
                <span className="truncate">{conta.favorecidoOuCliente}</span>
              </span>
              <span className="flex-shrink-0 text-right">
                <span className="block font-medium text-foreground">{formatarMoeda(conta.valor)}</span>
                <span className="block text-xs text-muted">
                  {vencendoHoje ? "Vence hoje" : formatarData(conta.dataVencimento)}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
