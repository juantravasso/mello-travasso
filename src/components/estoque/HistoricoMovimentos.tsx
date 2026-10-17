import type { MovimentoEstoque, Obra } from "@/types";
import { Card } from "@/components/ui/Card";
import { formatarDataHora } from "@/lib/formatadores";

const TONS: Record<MovimentoEstoque["tipo"], string> = {
  entrada: "bg-success",
  saida: "bg-danger",
  ajuste: "bg-info",
};

function rotulo(movimento: MovimentoEstoque, unidade?: string): string {
  const quantidade = movimento.quantidade.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
  const comUnidade = unidade ? `${quantidade} ${unidade}` : quantidade;
  if (movimento.tipo === "entrada") return `Entrada de ${comUnidade}`;
  if (movimento.tipo === "saida") return `Saída de ${comUnidade}`;
  return `Ajuste para ${comUnidade}`;
}

export function HistoricoMovimentos({
  movimentos,
  obraPorId,
  unidade,
}: {
  movimentos: MovimentoEstoque[];
  obraPorId: Map<string, Obra>;
  unidade?: string;
}) {
  return (
    <Card className="flex flex-col gap-3">
      <h2 className="font-medium">Histórico de movimentações</h2>
      {movimentos.length === 0 && <p className="text-sm text-muted">Nenhuma movimentação ainda.</p>}
      <ul className="flex flex-col gap-3">
        {movimentos.map((movimento) => (
          <li key={movimento.id} className="flex items-start gap-3 text-sm">
            <span className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${TONS[movimento.tipo]}`} />
            <div className="min-w-0 flex-1">
              <p className="text-foreground">{rotulo(movimento, unidade)}</p>
              <p className="text-xs text-muted">
                {obraPorId.get(movimento.obraId)?.nome ?? "Projeto não encontrado"}
                {movimento.origem === "item_produto" && " · item de nota fiscal"}
                {movimento.origem === "estorno" && " · estorno de conta cancelada"} · {movimento.lancadoPor}
              </p>
              {movimento.observacao && <p className="text-xs text-muted">{movimento.observacao}</p>}
            </div>
            <span className="flex-shrink-0 text-xs text-muted">{formatarDataHora(movimento.criadoEm)}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
