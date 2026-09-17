import type { StatusObra } from "@/types";
import { Badge } from "./Badge";

const rotulos: Record<StatusObra, string> = {
  em_andamento: "Em andamento",
  concluida: "Concluída",
  pausada: "Pausada",
};

const tons: Record<StatusObra, "success" | "danger" | "neutral"> = {
  em_andamento: "success",
  concluida: "neutral",
  pausada: "danger",
};

export function StatusObraBadge({ status }: { status: StatusObra }) {
  return <Badge tom={tons[status]}>{rotulos[status]}</Badge>;
}
