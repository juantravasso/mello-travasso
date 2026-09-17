import type { EventoHistorico } from "@/types";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { formatarDataHora } from "@/lib/formatadores";

const ROTULOS: Record<EventoHistorico["tipo"], string> = {
  criacao: "Criada por",
  edicao: "Editada por",
  baixa: "Baixada por",
  cancelamento: "Cancelada por",
};

const TONS: Record<EventoHistorico["tipo"], string> = {
  criacao: "bg-info",
  edicao: "bg-primary",
  baixa: "bg-success",
  cancelamento: "bg-danger",
};

export function HistoricoConta({ eventos }: { eventos: EventoHistorico[] }) {
  const ordenados = [...eventos].sort((a, b) => b.data.localeCompare(a.data));

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="font-medium">Histórico</h2>
      <ul className="flex flex-col gap-3">
        {ordenados.map((evento) => (
          <li key={evento.id} className="flex items-start gap-3 text-sm">
            <span className={cn("mt-1.5 h-2 w-2 flex-shrink-0 rounded-full", TONS[evento.tipo])} />
            <div className="min-w-0 flex-1">
              <p className="text-foreground">
                {ROTULOS[evento.tipo]} <span className="font-medium">{evento.usuario}</span>
              </p>
              {evento.detalhes && <p className="text-xs text-muted">{evento.detalhes}</p>}
            </div>
            <span className="flex-shrink-0 text-xs text-muted">{formatarDataHora(evento.data)}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
