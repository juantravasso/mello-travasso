import type { StatusConta, TipoConta } from "@/types";
import { Badge } from "./Badge";

export function StatusContaBadge({ status, tipo }: { status: StatusConta; tipo: TipoConta }) {
  if (status === "baixada") {
    return <Badge tom="success">{tipo === "pagar" ? "Paga" : "Recebida"}</Badge>;
  }
  return <Badge tom="danger">Em aberto</Badge>;
}
