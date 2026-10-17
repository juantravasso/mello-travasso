"use client";

import type { CompromissoItem } from "@/types";
import { DIAS_DA_SEMANA_CURTO, diasDaGradeMensal, diasDaSemana, mesmoMes, rotuloDoDia } from "@/lib/calendario/grade";
import { COR_CATEGORIA, ROTULO_CATEGORIA, ROTULO_STATUS } from "@/lib/calendario/categorias";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ChipCompromisso } from "./ChipCompromisso";

interface PropsBase {
  cursor: string;
  hoje: string;
  itens: CompromissoItem[];
  aoAbrir: (c: CompromissoItem) => void;
  aoIrParaDia: (data: string) => void;
}

function porDia(itens: CompromissoItem[]): Map<string, CompromissoItem[]> {
  const mapa = new Map<string, CompromissoItem[]>();
  for (const c of itens) mapa.set(c.data, [...(mapa.get(c.data) ?? []), c]);
  return mapa;
}

const MAX_CHIPS_NO_MES = 3;

export function GradeMensal({ cursor, hoje, itens, aoAbrir, aoIrParaDia }: PropsBase) {
  const dias = diasDaGradeMensal(cursor);
  const agrupados = porDia(itens);
  return (
    <Card className="overflow-hidden p-0">
      <div className="grid grid-cols-7 border-b border-border bg-surface-2 text-center text-xs font-medium text-muted">
        {DIAS_DA_SEMANA_CURTO.map((d) => (
          <div key={d} className="py-2">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {dias.map((dia) => {
          const doDia = agrupados.get(dia) ?? [];
          const ehHoje = dia === hoje;
          const foraDoMes = !mesmoMes(dia, cursor);
          return (
            <div key={dia} className={cn("flex min-h-16 flex-col gap-1 border-b border-r border-border p-1 sm:min-h-28 sm:p-1.5", foraDoMes && "bg-surface-2/50")}>
              <button
                type="button"
                onClick={() => aoIrParaDia(dia)}
                aria-label={`${rotuloDoDia(dia)}${doDia.length > 0 ? `, ${doDia.length} compromisso${doDia.length === 1 ? "" : "s"}` : ""}`}
                aria-current={ehHoje ? "date" : undefined}
                className={cn(
                  "flex h-6 w-6 items-center justify-center self-start rounded-full text-xs tabular-nums transition-colors hover:bg-surface-2",
                  ehHoje ? "bg-primary font-semibold text-primary-foreground hover:bg-primary" : foraDoMes ? "text-muted" : "text-foreground",
                )}
              >
                {Number(dia.slice(8, 10))}
              </button>
              {/* Celular: só pontos coloridos; a partir de sm: o título de cada compromisso. */}
              <div className="flex flex-wrap gap-0.5 sm:hidden">
                {doDia.slice(0, 6).map((c) => (
                  <span key={c.id} aria-hidden className={cn("h-1.5 w-1.5 rounded-full", COR_CATEGORIA[c.categoria].ponto)} />
                ))}
              </div>
              <div className="hidden flex-col gap-0.5 sm:flex">
                {doDia.slice(0, MAX_CHIPS_NO_MES).map((c) => (
                  <ChipCompromisso key={c.id} c={c} aoAbrir={aoAbrir} compacto />
                ))}
                {doDia.length > MAX_CHIPS_NO_MES && (
                  <button type="button" onClick={() => aoIrParaDia(dia)} className="px-1.5 text-left text-xs text-muted hover:text-foreground">
                    +{doDia.length - MAX_CHIPS_NO_MES} mais
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export function VisaoSemana({ cursor, hoje, itens, aoAbrir, aoIrParaDia }: PropsBase) {
  const dias = diasDaSemana(cursor);
  const agrupados = porDia(itens);
  return (
    <div className="grid gap-2 md:grid-cols-7">
      {dias.map((dia, i) => {
        const doDia = agrupados.get(dia) ?? [];
        const ehHoje = dia === hoje;
        return (
          <Card key={dia} className={cn("flex min-h-24 flex-col gap-2 p-2.5", ehHoje && "border-primary")}>
            <button type="button" onClick={() => aoIrParaDia(dia)} className="flex items-baseline gap-1.5 text-left text-sm hover:text-primary" aria-label={rotuloDoDia(dia)}>
              <span className="text-xs font-medium text-muted">{DIAS_DA_SEMANA_CURTO[i]}</span>
              <span className={cn("font-semibold tabular-nums", ehHoje ? "text-primary" : "text-foreground")}>{Number(dia.slice(8, 10))}</span>
            </button>
            {doDia.length === 0 ? <p className="text-xs text-muted">Livre</p> : doDia.map((c) => <ChipCompromisso key={c.id} c={c} aoAbrir={aoAbrir} />)}
          </Card>
        );
      })}
    </div>
  );
}

export function VisaoDia({ cursor, itens, aoAbrir, aoCriar }: Omit<PropsBase, "aoIrParaDia" | "hoje"> & { aoCriar: () => void }) {
  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-base font-semibold text-foreground first-letter:uppercase">{rotuloDoDia(cursor)}</h2>
      {itens.length === 0 ? (
        <div className="flex flex-col items-start gap-2 py-4 text-sm text-muted">
          <p>Nenhum compromisso neste dia.</p>
          <Button type="button" variante="outline" tamanho="sm" onClick={aoCriar}>
            Criar compromisso
          </Button>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {itens.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => aoAbrir(c)} className="flex w-full items-start gap-3 py-3 text-left hover:bg-surface-2/50">
                <span className="w-24 flex-shrink-0 text-sm tabular-nums text-muted">{c.diaInteiro ? "Dia inteiro" : `${c.horaInicio}${c.horaFim ? ` – ${c.horaFim}` : ""}`}</span>
                <span className="min-w-0 flex-1">
                  <span className={cn("block truncate font-medium text-foreground", c.status !== "agendado" && "line-through opacity-70")}>{c.titulo}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-2">
                    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", COR_CATEGORIA[c.categoria].chip)}>{ROTULO_CATEGORIA[c.categoria]}</span>
                    {c.status !== "agendado" && <span className="text-xs text-muted">{ROTULO_STATUS[c.status]}</span>}
                    {!c.souCriador && <span className="text-xs text-muted">de {c.criadoPor.nome}</span>}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
