import type { StatusFuncionario } from "@/types";
import { Badge } from "./Badge";

export function StatusFuncionarioBadge({ status }: { status: StatusFuncionario }) {
  return <Badge tom={status === "ativo" ? "success" : "neutral"}>{status === "ativo" ? "Ativo" : "Inativo"}</Badge>;
}
