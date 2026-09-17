import type { ItemAtividade } from "@/lib/dashboardMetrics";
import { cn } from "@/lib/cn";

function tempoRelativo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutos = Math.round(diffMs / 60000);
  if (minutos < 1) return "agora";
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `há ${horas}h`;
  const dias = Math.round(horas / 24);
  return `há ${dias}d`;
}

export function AtividadeRecenteList({ itens }: { itens: ItemAtividade[] }) {
  if (itens.length === 0) return <p className="text-sm text-muted">Nenhuma atividade registrada ainda.</p>;

  return (
    <ul className="flex flex-col gap-3">
      {itens.map((item) => (
        <li key={item.id} className="flex items-start gap-3 text-sm">
          <span
            className={cn(
              "mt-1.5 h-2 w-2 flex-shrink-0 rounded-full",
              item.tom === "success" && "bg-success",
              item.tom === "info" && "bg-info",
              item.tom === "danger" && "bg-danger",
            )}
          />
          <span className="flex-1 text-foreground">{item.descricao}</span>
          <span className="flex-shrink-0 text-xs text-muted">{tempoRelativo(item.quando)}</span>
        </li>
      ))}
    </ul>
  );
}
