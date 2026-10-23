"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ChecklistOnboarding } from "@/types";
import { obterChecklistOnboarding, ocultarChecklistOnboarding } from "@/services/data/server/onboardingActions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SugestaoInstalar } from "./SugestaoInstalar";
import { cn } from "@/lib/cn";

/**
 * Primeiros passos, calculados de fatos reais (projeto criado, conta lançada, perfil publicado…). Não há botão de
 * "marcar como feito": o item só fica concluído quando a ação acontece. No painel, some se a pessoa ocultar; em Ajuda
 * aparece sempre, com a opção de voltar a mostrá-lo no painel.
 */
export function ChecklistAtivacao({ modo }: { modo: "painel" | "ajuda" }) {
  const [dados, setDados] = useState<ChecklistOnboarding | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let ativo = true;
    obterChecklistOnboarding()
      .then((r) => {
        if (!ativo) return;
        if (r.ok) setDados(r.dados);
        else setErro(true);
      })
      .catch(() => ativo && setErro(true));
    return () => {
      ativo = false;
    };
  }, []);

  async function definirOculto(oculto: boolean) {
    setDados((d) => (d ? { ...d, oculto } : d));
    await ocultarChecklistOnboarding(oculto).catch(() => undefined);
  }

  if (erro || !dados || dados.total === 0) return null;
  // Depois da primeira ação concluída, e mesmo com o checklist oculto, sugere (uma vez) instalar o ícone no celular.
  const sugestao = modo === "painel" && dados.feitos >= 1 ? <SugestaoInstalar /> : null;
  if (modo === "painel" && dados.oculto) return sugestao;

  const completo = dados.feitos === dados.total;
  const percentual = Math.round((dados.feitos / dados.total) * 100);

  return (
    <>
      <Card className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="font-semibold text-foreground">{completo ? "Primeiros passos concluídos" : "Primeiros passos"}</h2>
            <p className="text-sm text-muted">
              {completo ? "Você já fez o essencial. As dicas de cada tela continuam em Como funciona?." : "Cada item é concluído quando a ação acontece no sistema."}
            </p>
          </div>
          <span className="text-sm font-medium tabular-nums text-foreground">
            {dados.feitos} de {dados.total}
          </span>
        </div>

        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuemin={0} aria-valuemax={dados.total} aria-valuenow={dados.feitos} aria-label="Progresso dos primeiros passos">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percentual}%` }} />
        </div>

        <ul className="flex flex-col divide-y divide-border">
          {dados.itens.map((item) => {
            const proximo = item.id === dados.proximoId;
            return (
              <li key={item.id} className="flex items-start gap-3 py-3">
                <span
                  aria-hidden
                  className={cn("mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border", item.feito ? "border-success bg-success text-white" : "border-border")}
                >
                  {item.feito && (
                    <svg viewBox="0 0 20 20" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m4.5 10.5 3.5 3.5 7.5-8" />
                    </svg>
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm font-medium", item.feito ? "text-muted" : "text-foreground")}>
                    {item.titulo}
                    <span className="sr-only">{item.feito ? " (concluído)" : " (pendente)"}</span>
                  </p>
                  {!item.feito && <p className="text-sm text-muted">{item.descricao}</p>}
                </div>
                {!item.feito && (
                  <Link href={item.href} className="flex-shrink-0">
                    <Button type="button" tamanho="sm" variante={proximo ? "primary" : "outline"}>
                      {proximo ? `Continuar: ${item.rotuloAcao}` : item.rotuloAcao}
                    </Button>
                  </Link>
                )}
              </li>
            );
          })}
        </ul>

        <div className="flex justify-end">
          {dados.oculto ? (
            <Button type="button" variante="ghost" tamanho="sm" onClick={() => definirOculto(false)}>
              Voltar a mostrar no painel
            </Button>
          ) : (
            <Button type="button" variante="ghost" tamanho="sm" onClick={() => definirOculto(true)}>
              Ocultar do painel
            </Button>
          )}
        </div>
      </Card>
      {sugestao}
    </>
  );
}
