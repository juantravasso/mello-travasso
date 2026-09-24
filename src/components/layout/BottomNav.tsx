"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import {
  IconeCadastro,
  IconeCaixa,
  IconeCamera,
  IconeConfig,
  IconeDashboard,
  IconeEntrada,
  IconeSaida,
} from "./icones";

const itens = [
  { href: "/dashboard", rotulo: "Início", Icone: IconeDashboard },
  { href: "/capturar", rotulo: "Capturar", Icone: IconeCamera },
  { href: "/contas-a-pagar", rotulo: "A Pagar", Icone: IconeSaida },
  { href: "/contas-a-receber", rotulo: "A Receber", Icone: IconeEntrada },
  { href: "/estoque", rotulo: "Estoque", Icone: IconeCaixa },
  { href: "/cadastro", rotulo: "Cadastro", Icone: IconeCadastro, tambem: ["/obras", "/funcionarios", "/fornecedores"] },
  { href: "/configuracoes", rotulo: "Ajustes", Icone: IconeConfig },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-sidebar/95 backdrop-blur supports-[backdrop-filter]:bg-sidebar/85 md:hidden">
      <ul className="flex overflow-x-auto">
        {itens.map(({ href, rotulo, Icone, ...resto }) => {
          const prefixosExtras = "tambem" in resto ? resto.tambem : [];
          const ativo =
            pathname === href ||
            pathname.startsWith(`${href}/`) ||
            prefixosExtras.some((prefixo) => pathname === prefixo || pathname.startsWith(`${prefixo}/`));
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className={cn(
                  "flex min-w-[72px] flex-col items-center gap-1 px-2 py-3 text-[11px] font-medium transition-colors",
                  ativo ? "text-primary" : "text-muted",
                )}
              >
                <Icone className="h-5 w-5" />
                {rotulo}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
