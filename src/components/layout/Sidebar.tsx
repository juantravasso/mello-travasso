"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useBarraLateral } from "./BarraLateralContext";
import { Logo } from "./Logo";
import {
  IconeCaixa,
  IconeCamera,
  IconeConfig,
  IconeDashboard,
  IconeEntrada,
  IconeEscudo,
  IconeFornecedor,
  IconeMenu,
  IconeObra,
  IconePessoas,
  IconeRede,
  IconeSaida,
} from "./icones";

const itensGestao = [
  { href: "/dashboard", rotulo: "Dashboard", Icone: IconeDashboard },
  { href: "/capturar", rotulo: "Captura de documentos", Icone: IconeCamera },
  { href: "/contas-a-pagar", rotulo: "Contas a pagar", Icone: IconeSaida },
  { href: "/contas-a-receber", rotulo: "Contas a receber", Icone: IconeEntrada },
  { href: "/obras", rotulo: "Obras", Icone: IconeObra },
  { href: "/estoque", rotulo: "Estoque", Icone: IconeCaixa },
  { href: "/funcionarios", rotulo: "Funcionários", Icone: IconePessoas },
  { href: "/fornecedores", rotulo: "Fornecedores", Icone: IconeFornecedor },
] as const;

const itemRede = { href: "/minha-rede", rotulo: "Rede profissional", Icone: IconeRede } as const;
const itemAdmin = { href: "/admin", rotulo: "Administração", Icone: IconeEscudo } as const;

// Com a barra recolhida o nome só aparece no tooltip; aberta, o próprio item mostra o nome.
function ComTooltip({ rotulo, ativo, children }: { rotulo: string; ativo: boolean; children: ReactNode }) {
  if (!ativo) return <>{children}</>;
  return (
    <div className="group relative flex justify-center">
      {children}
      <span
        className="pointer-events-none absolute left-full top-1/2 z-40 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground opacity-0 shadow-lg transition-opacity delay-150 group-hover:opacity-100"
      >
        {rotulo}
      </span>
    </div>
  );
}

export function Sidebar({
  nomeUsuario,
  temGestao,
  admin,
}: {
  nomeUsuario: string;
  temGestao: boolean;
  admin: boolean;
}) {
  const pathname = usePathname();
  const { expandida, alternar } = useBarraLateral();
  // Sem o plano de gestão, os módulos continuam visíveis (apagados) e levam à
  // página de apresentação — o gratuito vê o que existe sem bloqueio agressivo.
  const itens = [
    itemRede,
    ...itensGestao.map((item) => ({ ...item, bloqueado: !temGestao })),
    ...(admin ? [itemAdmin] : []),
  ];

  const classeItem = (ativo: boolean) =>
    cn(
      "flex h-11 items-center rounded-lg transition-colors",
      expandida ? "w-full gap-3 px-3" : "w-11 justify-center",
      ativo ? "bg-primary/15 text-primary" : "text-muted hover:bg-surface-2 hover:text-foreground",
    );

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-border bg-sidebar transition-[width] duration-200 motion-reduce:transition-none md:flex",
        expandida ? "w-60" : "w-[68px] items-center",
      )}
    >
      <div
        className={cn(
          "flex w-full items-center border-b border-border py-4",
          expandida ? "justify-between gap-2 px-3" : "flex-col gap-3",
        )}
      >
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

      {/* Sem overflow-y-auto: definir só o eixo Y como auto faz o navegador
          tratar o eixo X como auto também, cortando o tooltip que aparece à
          direita do ícone. Com poucos itens, a lista não deve estourar a altura. */}
      <nav className={cn("w-full flex-1 py-4", expandida ? "px-3" : "px-2")}>
        <ul className="flex flex-col gap-1">
          {itens.map((item) => {
            const { href, rotulo, Icone } = item;
            const bloqueado = "bloqueado" in item && item.bloqueado;
            const ativo = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <li key={href}>
                <ComTooltip rotulo={bloqueado ? `${rotulo} (plano de gestão)` : rotulo} ativo={!expandida}>
                  <Link
                    href={href}
                    aria-label={rotulo}
                    aria-current={ativo ? "page" : undefined}
                    className={cn(classeItem(ativo), bloqueado && "opacity-50")}
                  >
                    <Icone className="h-5 w-5 flex-shrink-0" />
                    {expandida && <span className="truncate text-sm font-medium">{rotulo}</span>}
                  </Link>
                </ComTooltip>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className={cn("flex w-full flex-col gap-1 border-t border-border py-3", expandida ? "px-3" : "items-center px-2")}>
        <ComTooltip rotulo={nomeUsuario} ativo={!expandida}>
          <Link href="/configuracoes" aria-label={nomeUsuario} className={classeItem(false)}>
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary">
              {nomeUsuario.slice(0, 1).toUpperCase()}
            </span>
            {expandida && <span className="truncate text-sm font-medium">{nomeUsuario}</span>}
          </Link>
        </ComTooltip>
        <ComTooltip rotulo="Configurações" ativo={!expandida}>
          <Link href="/configuracoes" aria-label="Configurações" className={classeItem(pathname.startsWith("/configuracoes"))}>
            <IconeConfig className="h-5 w-5 flex-shrink-0" />
            {expandida && <span className="truncate text-sm font-medium">Configurações</span>}
          </Link>
        </ComTooltip>
      </div>
    </aside>
  );
}
