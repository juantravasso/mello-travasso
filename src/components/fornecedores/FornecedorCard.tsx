import Link from "next/link";
import type { Fornecedor } from "@/types";
import { Card } from "@/components/ui/Card";

export function FornecedorCard({ fornecedor }: { fornecedor: Fornecedor }) {
  return (
    <Link href={`/fornecedores/${fornecedor.id}`}>
      <Card className="flex items-center gap-3">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
          {fornecedor.nome
            .split(" ")
            .slice(0, 2)
            .map((parte) => parte[0])
            .join("")
            .toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{fornecedor.nome}</p>
          <p className="truncate text-sm text-muted">
            {fornecedor.telefone || fornecedor.email || fornecedor.documento || "—"}
          </p>
        </div>
      </Card>
    </Link>
  );
}
