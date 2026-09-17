import Link from "next/link";
import type { Funcionario, Obra } from "@/types";
import { Card } from "@/components/ui/Card";
import { StatusFuncionarioBadge } from "@/components/ui/StatusFuncionarioBadge";
import { formatarData } from "@/lib/formatadores";

export function FuncionarioCard({ funcionario, obra }: { funcionario: Funcionario; obra?: Obra }) {
  return (
    <Link href={`/funcionarios/${funcionario.id}`}>
      <Card className="flex items-center gap-3">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
          {funcionario.nome
            .split(" ")
            .slice(0, 2)
            .map((parte) => parte[0])
            .join("")
            .toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{funcionario.nome}</p>
          <p className="truncate text-sm text-muted">{funcionario.cargo}</p>
          {obra && <p className="truncate text-xs text-muted">{obra.nome}</p>}
        </div>
        <div className="flex flex-shrink-0 flex-col items-end gap-1">
          <StatusFuncionarioBadge status={funcionario.status} />
          <span className="text-xs text-muted">desde {formatarData(funcionario.dataAdmissao)}</span>
        </div>
      </Card>
    </Link>
  );
}
