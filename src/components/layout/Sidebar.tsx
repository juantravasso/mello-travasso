"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useBarraLateral } from "./BarraLateralContext";
import { IconeMenu } from "./icones";
import { Logo } from "./Logo";
import { itemAtivo, TITULO_GRUPO, type GrupoNavegacao } from "./navegacao";
import { ResumoPlano } from "./ResumoPlano";
import { useItensNavegacao } from "./useItensNavegacao";

// Grupos do corpo da barra; "conta" (planos, ajuda, configurações) fica no rodapé.
const GRUPOS_DO_CORPO: readonly GrupoNavegacao[] = ["profissionais", "gestao", "admin"];

// Com a barra recolhida o nome só aparece no tooltip; aberta, o próprio item mostra o nome.
function ComTooltip({ rotulo, ativo, children }: { rotulo: string; ativo: boolean; children: ReactNode }) {
  if (!ativo) return <>{children}</>;
  return (
    <div className="group relative flex justify-center">
      {children}
      <span className="pointer-events-none absolute left-full top-1/2 z-40 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground opacity-0 shadow-lg transition-opacity delay-150 group-hover:opacity-100">
        {rotulo}
      </span>
    </div>
  );
}

/** Barra lateral do computador. No celular o equivalente é o MenuMovel, aberto pelo hambúrguer do topo. */
export function Sidebar({ nomeUsuario, temGestao, admin }: { nomeUsuario: string; temGestao: boolean; admin: boolean }) {
  const pathname = usePathname();
  const { expandida, alternar } = useBarraLateral();
  // Sem o plano de gestão, os módulos continuam visíveis (apagados) e levam à página de apresentação: o gratuito vê o
  // que existe sem bloqueio agressivo. Funcionário só vê os módulos que o dono liberou (useItensNavegacao).
  const itens = useItensNavegacao(admin);
  const corpo = itens.filter((i) => GRUPOS_DO_CORPO.includes(i.grupo));
  const rodape = itens.filter((i) => i.grupo === "conta");

  const classeItem = (ativo: boolean, destaque = false) =>
    cn(
      "flex h-11 items-center rounded-lg transition-colors",
      expandida ? "w-full gap-3 px-3" : "w-11 justify-center",
      ativo ? "bg-primary/15 text-primary" : destaque ? "border border-primary/40 text-primary hover:bg-primary/10" : "text-muted hover:bg-surface-2 hover:text-foreground",
    );

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-border bg-sidebar transition-[width] duration-200 motion-reduce:transition-none md:flex",
        expandida ? "w-60" : "w-[68px] items-center",
      )}
    >
      <div className={cn("flex w-full items-center border-b border-border py-4", expandida ? "justify-between gap-2 px-3" : "flex-col gap-3")}>
        {expandida ? <Logo tamanho="sm" className="min-w-0" /> : <Logo tamanho="sm" comTexto={false} />}
        <button
          type="button"
          onClick={alternar}
          aria-label={expandida ? "Recolher barra lateral" : "Expandir barra lateral"}
          aria-expanded={expandida}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
        >
          <IconeMenu className="h-5 w-5" />
        </button>
      </div>

      {/* Recolhida: sem overflow-y-auto: definir só o eixo Y como auto faz o navegador tratar o eixo X como auto também,
          cortando o tooltip que aparece à direita do ícone. Só em telas curtas (onde as abas não cabem) a lista passa a
          rolar, e nelas o tooltip pode ser cortado: é melhor que as abas se sobreporem ao rodapé. */}
      <nav className={cn("min-h-0 w-full flex-1 py-4", expandida ? "overflow-y-auto px-3" : "px-2 [@media(max-height:900px)]:overflow-y-auto [@media(max-height:900px)]:overflow-x-hidden [@media(max-height:900px)]:[scrollbar-width:none]")}>
        <ul className="flex flex-col gap-1">
          {corpo.map((item, indice) => {
            const novoGrupo = indice === 0 || corpo[indice - 1]?.grupo !== item.grupo;
            const bloqueado = item.gestao && !temGestao;
            const ativo = itemAtivo(item, pathname);
            return (
              <Fragment key={item.href}>
                {novoGrupo &&
                  (expandida ? (
                    <li className="px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-widest text-muted first:pt-0">{TITULO_GRUPO[item.grupo]}</li>
                  ) : (
                    indice > 0 && <li role="separator" className="mx-2 my-2 border-t border-border" />
                  ))}
                <li>
                  <ComTooltip rotulo={bloqueado ? `${item.rotulo} (plano de gestão)` : item.rotulo} ativo={!expandida}>
                    <Link
                      href={item.href}
                      aria-label={item.rotulo}
                      aria-current={ativo ? "page" : undefined}
                      className={cn(classeItem(ativo, item.destaque), bloqueado && "opacity-50")}
                    >
                      <item.Icone className="h-5 w-5 flex-shrink-0" />
                      {expandida && <span className="truncate text-sm font-medium">{item.rotulo}</span>}
                    </Link>
                  </ComTooltip>
                </li>
              </Fragment>
            );
          })}
        </ul>
      </nav>

      <div className={cn("flex w-full flex-col gap-1 border-t border-border py-3", expandida ? "px-3" : "items-center px-2")}>
        {expandida && <ResumoPlano className="mb-1" />}
        {rodape.map((item) => (
          <ComTooltip key={item.href} rotulo={item.rotulo} ativo={!expandida}>
            <Link href={item.href} aria-label={item.rotulo} aria-current={itemAtivo(item, pathname) ? "page" : undefined} className={classeItem(itemAtivo(item, pathname))}>
              <item.Icone className="h-5 w-5 flex-shrink-0" />
              {expandida && <span className="truncate text-sm font-medium">{item.rotulo}</span>}
            </Link>
          </ComTooltip>
        ))}
        {/* O nome só aparece com a barra aberta: recolhida, o avatar repetiria o link de Configurações e gastaria altura. */}
        {expandida && (
          <Link href="/configuracoes" aria-label={nomeUsuario} className={classeItem(false)}>
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary">
              {nomeUsuario.slice(0, 1).toUpperCase()}
            </span>
            <span className="truncate text-sm font-medium">{nomeUsuario}</span>
          </Link>
        )}
      </div>
    </aside>
  );
}
