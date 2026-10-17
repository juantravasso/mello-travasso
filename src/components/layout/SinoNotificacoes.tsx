"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { NotificacaoItem } from "@/types";
import { redeRepositorio } from "@/services/data";
import { formatarDataHora } from "@/lib/formatadores";
import { cn } from "@/lib/cn";
import { IconeSino } from "./icones";

const INTERVALO_ATUALIZACAO_MS = 60_000;

/**
 * Sino do topo: mostra quantas notificações não foram lidas e abre a lista das recentes. A contagem se atualiza
 * sozinha (a cada minuto, ao voltar para a aba e a cada navegação), sem recarregar a página.
 */
export function SinoNotificacoes() {
  const pathname = usePathname();
  const router = useRouter();
  const [naoLidas, setNaoLidas] = useState(0);
  const [aberto, setAberto] = useState(false);
  const [itens, setItens] = useState<NotificacaoItem[] | null>(null);
  const [erro, setErro] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);

  const contar = useCallback(() => {
    redeRepositorio
      .contarNotificacoesNaoLidas()
      .then(setNaoLidas)
      .catch(() => undefined);
  }, []);

  const carregarLista = useCallback(() => {
    setErro(false);
    redeRepositorio
      .listarNotificacoes()
      .then((lista) => setItens(lista.slice(0, 15)))
      .catch(() => setErro(true));
  }, []);

  useEffect(() => {
    contar();
    // Reconta a cada navegação (ler uma notificação muda o número).
  }, [contar, pathname]);

  useEffect(() => {
    const intervalo = window.setInterval(() => {
      if (document.visibilityState === "visible") contar();
    }, INTERVALO_ATUALIZACAO_MS);
    const aoVoltar = () => {
      if (document.visibilityState === "visible") contar();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      window.clearInterval(intervalo);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, [contar]);

  useEffect(() => {
    if (aberto) carregarLista();
  }, [aberto, carregarLista]);

  useEffect(() => {
    if (!aberto) return;
    function aoClicarFora(e: MouseEvent) {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAberto(false);
    }
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") setAberto(false);
    }
    document.addEventListener("mousedown", aoClicarFora);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("mousedown", aoClicarFora);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [aberto]);

  async function abrir(n: NotificacaoItem) {
    setAberto(false);
    if (!n.lida) {
      setNaoLidas((v) => Math.max(0, v - 1));
      await redeRepositorio.marcarNotificacaoLida(n.id).catch(() => undefined);
    }
    router.push(n.href);
  }

  async function marcarTodas() {
    setItens((lista) => lista?.map((n) => ({ ...n, lida: true })) ?? null);
    setNaoLidas(0);
    await redeRepositorio.marcarTodasNotificacoesLidas().catch(() => undefined);
    contar();
  }

  return (
    <div ref={raiz} className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        aria-haspopup="dialog"
        aria-label={naoLidas > 0 ? `Notificações, ${naoLidas} não lidas` : "Notificações"}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
      >
        <IconeSino className="h-5 w-5" />
        {naoLidas > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white tabular-nums">
            {naoLidas > 9 ? "9+" : naoLidas}
          </span>
        )}
      </button>

      {aberto && (
        <div
          role="dialog"
          aria-label="Notificações"
          className="fixed inset-x-3 top-14 z-50 flex max-h-[70vh] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xl shadow-black/30 sm:absolute sm:inset-x-auto sm:right-0 sm:top-11 sm:w-96"
        >
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
            <p className="text-sm font-semibold text-foreground">Notificações</p>
            <button type="button" onClick={marcarTodas} disabled={naoLidas === 0} className="text-xs font-medium text-primary hover:underline disabled:cursor-default disabled:text-muted disabled:no-underline">
              Marcar todas como lidas
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {erro ? (
              <p role="alert" className="px-4 py-6 text-sm text-danger">
                Não foi possível carregar agora.{" "}
                <button type="button" onClick={carregarLista} className="font-medium underline">
                  Tentar de novo
                </button>
              </p>
            ) : !itens ? (
              <div className="m-4 h-20 animate-pulse rounded-lg bg-surface-2" aria-busy="true" />
            ) : itens.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted">Nenhuma notificação por aqui. Os lembretes dos seus compromissos aparecem neste lugar.</p>
            ) : (
              <ul className="divide-y divide-border">
                {itens.map((n) => (
                  <li key={n.id}>
                    <button type="button" onClick={() => abrir(n)} className={cn("flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2", !n.lida && "bg-primary/5")}>
                      <span aria-hidden className={cn("mt-1.5 h-2 w-2 flex-shrink-0 rounded-full", n.lida ? "bg-transparent" : "bg-primary")} />
                      <span className="min-w-0 flex-1">
                        {n.titulo && <span className={cn("block truncate text-sm text-foreground", !n.lida && "font-semibold")}>{n.titulo}</span>}
                        <span className={cn("block text-sm", n.titulo ? "text-muted" : "text-foreground")}>{n.texto}</span>
                        <span className="mt-0.5 block text-xs text-muted tabular-nums">
                          {formatarDataHora(n.criadoEm)}
                          {n.compromissoId && " · compromisso"}
                          {n.lida ? "" : " · não lida"}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-border px-4 py-2.5">
            <Link href="/minha-rede/notificacoes" onClick={() => setAberto(false)} className="text-sm font-medium text-primary hover:underline">
              Ver todas
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
