"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";
import { useStatusPlano } from "./StatusPlanoContext";

/**
 * Onde a pessoa vê, sempre à mão, em que ponto do teste está e o caminho para ver os planos e os valores. Não aparece
 * para quem já tem plano ativo ou cortesia.
 */
export function ResumoPlano({ className, aoNavegar }: { className?: string; aoNavegar?: () => void }) {
  const status = useStatusPlano();
  if (status.plano === "ativo" || status.plano === "cortesia") return null;

  let titulo: string;
  if (status.plano === "teste" && !status.somenteLeitura && status.diasRestantes !== null) {
    const dias = Math.max(status.diasRestantes, 0);
    titulo = `Teste grátis: ${dias} ${dias === 1 ? "dia restante" : "dias restantes"}`;
  } else if (status.plano === "teste") {
    titulo = "Teste encerrado";
  } else if (status.plano === "suspenso") {
    titulo = "Assinatura inativa";
  } else {
    titulo = "Plano gratuito";
  }

  const alerta = status.somenteLeitura || (status.plano === "teste" && (status.diasRestantes ?? 99) <= 3);

  return (
    <div className={cn("rounded-lg border px-3 py-2.5", alerta ? "border-warning/50 bg-warning-bg" : "border-border bg-surface-2", className)}>
      <p className={cn("text-xs font-semibold", alerta ? "text-warning" : "text-foreground")}>{titulo}</p>
      <Link href="/planos" onClick={aoNavegar} className="text-xs font-medium text-primary underline underline-offset-2">
        Ver planos e valores
      </Link>
    </div>
  );
}
