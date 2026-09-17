import Link from "next/link";
import type { Obra } from "@/types";
import { Card } from "@/components/ui/Card";
import { StatusObraBadge } from "@/components/ui/StatusObraBadge";
import { formatarData } from "@/lib/formatadores";

export function ObraCard({ obra }: { obra: Obra }) {
  return (
    <Link href={`/obras/${obra.id}`}>
      <Card className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{obra.nome}</p>
          <p className="truncate text-sm text-muted">{obra.cliente}</p>
          <p className="text-xs text-muted">Início em {formatarData(obra.dataInicio)}</p>
        </div>
        <StatusObraBadge status={obra.status} />
      </Card>
    </Link>
  );
}
