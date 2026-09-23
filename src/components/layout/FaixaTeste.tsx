"use client";

import { useStatusPlano } from "./StatusPlanoContext";

/**
 * RF-15/RF-16: faixa do período de teste. Não aparece para cortesia/ativo
 * (diasRestantes null) nem quando faltam mais de 7 dias — só de D-7 em
 * diante, e muda de cor/texto quando o teste já venceu.
 */
export function FaixaTeste() {
  const status = useStatusPlano();

  if (status.plano !== "teste" || status.diasRestantes === null) return null;
  if (!status.somenteLeitura && status.diasRestantes > 7) return null;

  if (status.somenteLeitura) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-danger bg-danger-bg px-4 py-2 text-sm text-danger sm:px-8">
        <span>Teste encerrado — os dados continuam disponíveis para consulta.</span>
        <a href="mailto:contato@mellotravasso.com.br" className="font-medium underline underline-offset-2">
          Falar com a equipe
        </a>
      </div>
    );
  }

  const tom = status.diasRestantes <= 1 ? "warning" : "info";
  const classeCor = tom === "warning" ? "border-warning bg-warning-bg text-warning" : "border-info bg-info-bg text-info";

  return (
    <div className={`flex items-center justify-center gap-2 border-b px-4 py-2 text-sm sm:px-8 ${classeCor}`}>
      <span>
        Seu teste termina em {status.diasRestantes} {status.diasRestantes === 1 ? "dia" : "dias"} ({status.dataFimFormatada}).
      </span>
    </div>
  );
}
