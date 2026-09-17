import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

interface KpiCardProps {
  rotulo: string;
  valor: string;
  variacao?: number | null;
  legendaVariacao?: string;
  subtitulo?: string;
}

export function KpiCard({ rotulo, valor, variacao, legendaVariacao, subtitulo }: KpiCardProps) {
  const temVariacao = variacao !== undefined && variacao !== null;
  const positiva = temVariacao && (variacao as number) >= 0;

  return (
    <Card className="flex flex-col gap-1.5">
      <span className="text-sm text-muted">{rotulo}</span>
      <span className="text-2xl font-semibold text-foreground">{valor}</span>
      {temVariacao && (
        <span className={cn("flex items-center gap-1 text-xs font-medium", positiva ? "text-success" : "text-danger")}>
          {positiva ? "↑" : "↓"} {Math.abs(variacao as number).toFixed(0)}% {legendaVariacao ?? "vs. mês anterior"}
        </span>
      )}
      {subtitulo && !temVariacao && <span className="text-xs text-muted">{subtitulo}</span>}
    </Card>
  );
}
