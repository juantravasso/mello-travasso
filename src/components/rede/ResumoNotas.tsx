import type { ResumoAvaliacoes } from "@/types";
import { EstrelasNota, formatarNota } from "./EstrelasNota";

export function ResumoNotas({ resumo }: { resumo: ResumoAvaliacoes }) {
  const { media, total, distribuicao, recomendacoes } = resumo;

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-8">
      <div className="flex flex-col gap-1">
        <p className="text-4xl font-semibold leading-none text-foreground tabular-nums">
          {media === null ? "—" : formatarNota(media)}
        </p>
        {media !== null && <EstrelasNota nota={media} tamanho="md" />}
        <p className="text-sm text-muted">
          {total === 0 ? "Sem avaliações ainda" : total === 1 ? "1 avaliação" : `${total} avaliações`}
          {recomendacoes > 0 && <> · {recomendacoes === 1 ? "1 recomendação" : `${recomendacoes} recomendações`}</>}
        </p>
      </div>

      {total > 0 && (
        <ul className="flex min-w-0 flex-1 flex-col gap-1.5" aria-label="Distribuição das notas">
          {([5, 4, 3, 2, 1] as const).map((nota) => {
            const quantidade = distribuicao[nota];
            return (
              <li key={nota} className="flex items-center gap-2 text-sm">
                <span className="w-10 flex-shrink-0 text-muted tabular-nums">{nota} ★</span>
                <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-2">
                  <span
                    className="block h-full rounded-full bg-primary"
                    style={{ width: `${(quantidade / total) * 100}%` }}
                  />
                </span>
                <span className="w-8 flex-shrink-0 text-right text-muted tabular-nums">{quantidade}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
