"use client";

import { useEffect } from "react";
import type { PlanoComercialPublico } from "@/types";
import { economiaAnual, formatarPreco } from "@/lib/planos/comercial";
import { MARCA } from "@/lib/marca";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { registrarInteracaoOferta } from "@/services/data/server/planosComerciaisActions";

const contato = (assunto: string) => `mailto:${MARCA.emailContato}?subject=${encodeURIComponent(assunto)}`;

function Precos({ plano }: { plano: PlanoComercialPublico }) {
  const mensal = formatarPreco(plano.precoMensalCentavos);
  const anual = formatarPreco(plano.precoAnualCentavos);
  const economia = economiaAnual(plano);
  if (!mensal && !anual) return <p className="text-lg font-semibold text-foreground">Sob consulta</p>;
  return (
    <div className="flex flex-col gap-0.5 tabular-nums">
      {mensal && (
        <p className="text-foreground">
          <span className="text-2xl font-semibold">{mensal}</span> <span className="text-sm text-muted">por mês</span>
        </p>
      )}
      {anual && (
        <p className="text-sm text-muted">
          {anual} por ano{economia ? ` (economia de ${economia.percentual}% frente a 12 mensalidades)` : ""}
        </p>
      )}
    </div>
  );
}

/** Página de planos: só o que a administração publicou, com os valores cadastrados. Não há checkout: o contato é com a equipe. */
export function PlanosComparacao({ planos }: { planos: PlanoComercialPublico[] }) {
  useEffect(() => {
    registrarInteracaoOferta({ contexto: "pagina_planos", tipo: "visualizada" }).catch(() => undefined);
  }, []);

  if (planos.length === 0) {
    return (
      <Card className="flex max-w-xl flex-col gap-2">
        <p className="font-medium text-foreground">Os planos e valores ainda não foram publicados.</p>
        <p className="text-sm text-muted">Para continuar usando depois do teste, fale com a equipe e combinamos o melhor caminho.</p>
        <a href={contato("Quero continuar usando o Elo Negócios")} className="text-sm font-medium text-primary underline underline-offset-2">
          Falar com a equipe
        </a>
      </Card>
    );
  }

  const beneficios = [...new Set(planos.flatMap((p) => p.beneficios))];

  return (
    <div className="flex flex-col gap-6">
      <div className={cn("grid gap-4", planos.length > 1 && "md:grid-cols-2", planos.length > 2 && "lg:grid-cols-3")}>
        {planos.map((p) => (
          <Card key={p.chave} className={cn("flex flex-col gap-3", p.destaque && "border-primary")}>
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-lg font-semibold text-foreground">{p.nome}</h2>
              {p.destaque && <Badge tom="info">Recomendado</Badge>}
            </div>
            <p className="text-sm text-muted">{p.descricao}</p>
            <Precos plano={p} />
            <ul className="flex flex-1 flex-col gap-1.5 text-sm">
              {p.beneficios.map((b) => (
                <li key={b} className="flex gap-2 text-foreground">
                  <span aria-hidden className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                  {b}
                </li>
              ))}
            </ul>
            <a
              href={contato(`Quero conhecer o plano ${p.nome}`)}
              onClick={() => void registrarInteracaoOferta({ contexto: "pagina_planos", tipo: "clicada", planoChave: p.chave }).catch(() => undefined)}
              className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-4 text-base font-medium text-primary-foreground transition-colors hover:opacity-90"
            >
              Falar com a equipe sobre este plano
            </a>
          </Card>
        ))}
      </div>

      {planos.length > 1 && beneficios.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <caption className="sr-only">Comparação do que cada plano inclui</caption>
            <thead>
              <tr className="border-b border-border text-left">
                <th scope="col" className="px-4 py-2 font-medium text-muted">
                  Inclui
                </th>
                {planos.map((p) => (
                  <th key={p.chave} scope="col" className="px-4 py-2 text-center font-semibold text-foreground">
                    {p.nome}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {beneficios.map((b) => (
                <tr key={b} className="border-b border-border last:border-b-0">
                  <th scope="row" className="px-4 py-2 text-left font-normal text-foreground">
                    {b}
                  </th>
                  {planos.map((p) => (
                    <td key={p.chave} className="px-4 py-2 text-center">
                      {p.beneficios.includes(b) ? <span aria-label="Incluído" className="text-success">✓</span> : <span aria-label="Não incluído" className="text-muted">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-muted">Valores definidos pela administração. A contratação é combinada com a equipe: ainda não há pagamento automático no sistema.</p>
    </div>
  );
}
