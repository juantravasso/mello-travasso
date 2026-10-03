"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { NotificacaoItem } from "@/types";
import { redeRepositorio } from "@/services/data";
import { formatarDataBr } from "@/lib/rede/texto";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

export function NotificacoesLista() {
  const router = useRouter();
  const [itens, setItens] = useState<NotificacaoItem[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setItens(await redeRepositorio.listarNotificacoes());
  }, []);

  useEffect(() => {
    carregar().catch(() => setErro("Não foi possível carregar agora. Tente de novo."));
  }, [carregar]);

  async function abrir(n: NotificacaoItem) {
    if (!n.lida) await redeRepositorio.marcarNotificacaoLida(n.id).catch(() => undefined);
    if (/^\/(?![\/\\])/.test(n.href)) router.push(n.href);
  }

  async function marcarTodas() {
    await redeRepositorio.marcarTodasNotificacoesLidas();
    await carregar();
    router.refresh();
  }

  if (erro) return <Card role="alert" className="border-danger bg-danger-bg text-sm text-danger">{erro}</Card>;
  if (!itens) return <Card className="h-24 animate-pulse bg-surface-2" aria-busy="true">{null}</Card>;
  if (itens.length === 0) {
    return <Card className="max-w-3xl text-sm text-muted">Nada por aqui ainda. Avisaremos quando alguém avaliar, responder ou recomendar.</Card>;
  }

  const naoLidas = itens.filter((n) => !n.lida).length;

  return (
    <div className="flex max-w-3xl flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted" aria-live="polite">
          {naoLidas === 0 ? "Tudo lido." : naoLidas === 1 ? "1 não lida" : `${naoLidas} não lidas`}
        </p>
        {naoLidas > 0 && (
          <Button type="button" tamanho="sm" variante="outline" onClick={marcarTodas}>
            Marcar todas como lidas
          </Button>
        )}
      </div>
      <ul className="flex flex-col gap-2">
        {itens.map((n) => (
          <li key={n.id}>
            <button
              type="button"
              onClick={() => abrir(n)}
              className={cn(
                "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-surface-2",
                n.lida ? "border-border bg-card" : "border-primary/50 bg-primary/10",
              )}
            >
              <span
                aria-hidden
                className={cn("mt-1.5 h-2 w-2 flex-shrink-0 rounded-full", n.lida ? "bg-transparent" : "bg-primary")}
              />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className={cn("text-sm", n.lida ? "text-foreground/80" : "font-medium text-foreground")}>{n.texto}</span>
                <span className="text-xs text-muted">{formatarDataBr(n.criadoEm)}</span>
              </span>
              {!n.lida && <span className="sr-only">Não lida</span>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
