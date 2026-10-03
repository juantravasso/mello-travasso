"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Logo } from "./Logo";
import {
  IconeCaixa,
  IconeCamera,
  IconeConfig,
  IconeDashboard,
  IconeEntrada,
  IconeEscudo,
  IconeFornecedor,
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

function ComTooltip({ rotulo, children }: { rotulo: string; children: ReactNode }) {
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
  // Sem o plano de gestão, os módulos continuam visíveis (apagados) e levam à
  // página de apresentação — o gratuito vê o que existe sem bloqueio agressivo.
  const itens = [
    itemRede,
    ...itensGestao.map((item) => ({ ...item, bloqueado: !temGestao })),
    ...(admin ? [itemAdmin] : []),
  ];
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[68px] flex-col items-center border-r border-border bg-sidebar md:flex">
      <div className="flex w-full justify-center border-b border-border py-4">
        <Logo tamanho="sm" comTexto={false} />
      </div>

      {/* Sem overflow-y-auto: definir só o eixo Y como auto faz o navegador
          tratar o eixo X como auto também, cortando o tooltip que aparece à
          direita do ícone. Com poucos itens, a lista não deve estourar a altura. */}
      <nav className="flex-1 px-2 py-4">
        <ul className="flex flex-col gap-1">
          {itens.map((item) => {
            const { href, rotulo, Icone } = item;
            const bloqueado = "bloqueado" in item && item.bloqueado;
            const ativo = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <li key={href}>
                <ComTooltip rotulo={bloqueado ? `${rotulo} (plano de gestão)` : rotulo}>
                  <Link
                    href={href}
                    aria-label={rotulo}
                    className={cn(
                      "flex h-11 w-11 items-center justify-center rounded-lg transition-colors",
                      ativo
                        ? "bg-primary/15 text-primary"
                        : "text-muted hover:bg-surface-2 hover:text-foreground",
                      bloqueado && "opacity-50",
                    )}
                  >
                    <Icone className="h-5 w-5 flex-shrink-0" />
                  </Link>
                </ComTooltip>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="flex w-full flex-col items-center gap-1 border-t border-border px-2 py-3">
        <ComTooltip rotulo={nomeUsuario}>
          <Link
            href="/configuracoes"
            aria-label={nomeUsuario}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary">
              {nomeUsuario.slice(0, 1).toUpperCase()}
            </span>
          </Link>
        </ComTooltip>
        <ComTooltip rotulo="Configurações">
          <Link
            href="/configuracoes"
            aria-label="Configurações"
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-lg transition-colors",
              pathname.startsWith("/configuracoes")
                ? "bg-primary/15 text-primary"
                : "text-muted hover:bg-surface-2 hover:text-foreground",
            )}
          >
            <IconeConfig className="h-5 w-5 flex-shrink-0" />
          </Link>
        </ComTooltip>
      </div>
    </aside>
  );
}
