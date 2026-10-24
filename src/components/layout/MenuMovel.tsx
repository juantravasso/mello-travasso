"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { MAXIMO_FAVORITOS } from "@/lib/layout/favoritos";
import { useFavoritos } from "@/hooks/useFavoritos";
import { useBarraLateral } from "./BarraLateralContext";
import { IconeEstrela, IconeFechar } from "./icones";
import { Logo } from "./Logo";
import { itemAtivo, TITULO_GRUPO, type GrupoNavegacao } from "./navegacao";
import { ResumoPlano } from "./ResumoPlano";
import { useItensNavegacao } from "./useItensNavegacao";

const ORDEM_GRUPOS: readonly GrupoNavegacao[] = ["profissionais", "gestao", "conta", "admin"];

/**
 * Menu lateral do celular: abre pelo ícone de hambúrguer e reúne todas as abas. A estrela fixa uma aba na barra de
 * baixo (só os favoritos aparecem lá). No computador a barra lateral fixa faz esse papel.
 */
export function MenuMovel({ temGestao, admin }: { temGestao: boolean; admin: boolean }) {
  const { menuMovelAberto, fecharMenuMovel } = useBarraLateral();
  const pathname = usePathname();
  const itens = useItensNavegacao(admin);
  const { favoritos, alternar } = useFavoritos(itens.map((i) => i.href));
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    if (!menuMovelAberto) return;
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") fecharMenuMovel();
    }
    document.addEventListener("keydown", aoTeclar);
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.body.style.overflow = overflowAnterior;
    };
  }, [menuMovelAberto, fecharMenuMovel]);

  if (!menuMovelAberto) return null;

  function tocarEstrela(href: string) {
    const r = alternar(href);
    setAviso(r.limiteAtingido ? `A barra de baixo comporta ${MAXIMO_FAVORITOS} abas. Tire uma estrela para escolher outra.` : null);
  }

  return (
    <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
      <div className="absolute inset-0 bg-black/60" onClick={fecharMenuMovel} />
      <nav className="absolute inset-y-0 left-0 flex w-[min(20rem,88vw)] flex-col border-r border-border bg-sidebar shadow-lg" aria-label="Todas as abas">
        <div className="flex flex-shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3">
          <Logo tamanho="sm" className="min-w-0" />
          <button
            type="button"
            onClick={fecharMenuMovel}
            aria-label="Fechar menu"
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
          >
            <IconeFechar className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          <p className="px-1 pb-2 text-xs text-muted">Toque na estrela para fixar a aba na barra de baixo (até {MAXIMO_FAVORITOS}).</p>
          {aviso && (
            <p role="status" className="mb-2 rounded-md border border-warning/40 bg-warning-bg px-3 py-2 text-xs text-warning">
              {aviso}
            </p>
          )}

          {ORDEM_GRUPOS.map((grupo) => {
            const doGrupo = itens.filter((i) => i.grupo === grupo);
            if (doGrupo.length === 0) return null;
            return (
              <section key={grupo} aria-label={TITULO_GRUPO[grupo]} className="mb-3">
                <h2 className="px-1 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-muted">{TITULO_GRUPO[grupo]}</h2>
                <ul className="flex flex-col gap-0.5">
                  {doGrupo.map((item) => {
                    const ativo = itemAtivo(item, pathname);
                    const favorito = favoritos.includes(item.href);
                    const bloqueado = item.gestao && !temGestao;
                    return (
                      <li key={item.href} className="flex items-center gap-1">
                        <Link
                          href={item.href}
                          onClick={fecharMenuMovel}
                          aria-current={ativo ? "page" : undefined}
                          className={cn(
                            "flex h-12 min-w-0 flex-1 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                            ativo ? "bg-primary/15 text-primary" : item.destaque ? "border border-primary/40 text-primary" : "text-foreground hover:bg-surface-2",
                            bloqueado && "opacity-50",
                          )}
                        >
                          <item.Icone className="h-5 w-5 flex-shrink-0" />
                          <span className="truncate">{item.rotulo}</span>
                        </Link>
                        <button
                          type="button"
                          aria-pressed={favorito}
                          aria-label={favorito ? `Tirar ${item.rotulo} dos favoritos` : `Fixar ${item.rotulo} na barra de baixo`}
                          onClick={() => tocarEstrela(item.href)}
                          className={cn(
                            "flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-primary",
                            favorito ? "text-warning" : "text-muted",
                          )}
                        >
                          <IconeEstrela preenchida={favorito} className="h-5 w-5" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>

        <div className="flex flex-shrink-0 flex-col gap-2 border-t border-border px-4 py-3">
          <ResumoPlano aoNavegar={fecharMenuMovel} />
        </div>
      </nav>
    </div>
  );
}
