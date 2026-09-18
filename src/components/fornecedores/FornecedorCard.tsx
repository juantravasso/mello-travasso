import type { Fornecedor } from "@/types";
import { Card } from "@/components/ui/Card";
import { formatarCpfCnpj } from "@/lib/documento";

export function FornecedorCard({ fornecedor, onClick }: { fornecedor: Fornecedor; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="text-left">
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
            {formatarCpfCnpj(fornecedor.documento) || fornecedor.telefone || fornecedor.email || "—"}
          </p>
        </div>
      </Card>
    </button>
  );
}
