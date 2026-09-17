"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { Logo } from "./Logo";
import { SeletorUsuarioAtual } from "./SeletorUsuarioAtual";
import {
  IconeCaixa,
  IconeCamera,
  IconeConfig,
  IconeDashboard,
  IconeEntrada,
  IconeObra,
  IconePessoas,
  IconeSaida,
} from "./icones";

const itens = [
  { href: "/dashboard", rotulo: "Dashboard", Icone: IconeDashboard },
  { href: "/capturar", rotulo: "Captura de documentos", Icone: IconeCamera },
  { href: "/contas-a-pagar", rotulo: "Contas a pagar", Icone: IconeSaida },
  { href: "/contas-a-receber", rotulo: "Contas a receber", Icone: IconeEntrada },
  { href: "/obras", rotulo: "Obras", Icone: IconeObra },
  { href: "/custos-produtos", rotulo: "Produtos e materiais", Icone: IconeCaixa },
  { href: "/funcionarios", rotulo: "Funcionários", Icone: IconePessoas },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-sidebar md:flex">
      <div className="border-b border-border px-5 py-5">
        <Logo tamanho="sm" />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="flex flex-col gap-1">
          {itens.map(({ href, rotulo, Icone }) => {
            const ativo = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    ativo
                      ? "bg-primary/15 text-primary"
                      : "text-muted hover:bg-surface-2 hover:text-foreground",
                  )}
                >
                  <Icone className="h-[18px] w-[18px] flex-shrink-0" />
                  <span className="truncate">{rotulo}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="flex flex-col gap-1 border-t border-border px-3 py-3">
        <SeletorUsuarioAtual />
        <Link
          href="/configuracoes"
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
            pathname.startsWith("/configuracoes")
              ? "bg-primary/15 text-primary"
              : "text-muted hover:bg-surface-2 hover:text-foreground",
          )}
        >
          <IconeConfig className="h-[18px] w-[18px] flex-shrink-0" />
          Configurações
        </Link>
      </div>
    </aside>
  );
}
