"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { podeAcessarRota } from "@/lib/auth/modulos";
import { useAcesso } from "./AcessoContext";
import {
  IconeCadastro,
  IconeCaixa,
  IconeCalendario,
  IconeCamera,
  IconeConfig,
  IconeDashboard,
  IconeEntrada,
  IconeEscudo,
  IconeRede,
  IconeSaida,
} from "./icones";

interface ItemNav {
  href: string;
  rotulo: string;
  Icone: typeof IconeDashboard;
  tambem?: readonly string[];
  gestao?: boolean;
}

const itens: readonly ItemNav[] = [
  { href: "/minha-rede", rotulo: "Rede", Icone: IconeRede },
  { href: "/dashboard", rotulo: "Início", Icone: IconeDashboard, gestao: true },
  {
    href: "/calendario",
    rotulo: "Agenda",
    Icone: IconeCalendario,
    gestao: true,
  },
  { href: "/capturar", rotulo: "Capturar", Icone: IconeCamera, gestao: true },
  {
    href: "/contas-a-pagar",
    rotulo: "A Pagar",
    Icone: IconeSaida,
    gestao: true,
  },
  {
    href: "/contas-a-receber",
    rotulo: "A Receber",
    Icone: IconeEntrada,
    gestao: true,
  },
  { href: "/estoque", rotulo: "Estoque", Icone: IconeCaixa, gestao: true },
  {
    href: "/cadastro",
    rotulo: "Cadastro",
    Icone: IconeCadastro,
    tambem: ["/obras", "/funcionarios", "/fornecedores"],
    gestao: true,
  },
  { href: "/configuracoes", rotulo: "Ajustes", Icone: IconeConfig },
];

const itemAdmin: ItemNav = {
  href: "/admin",
  rotulo: "Admin",
  Icone: IconeEscudo,
};

export function BottomNav({
  temGestao,
  admin,
}: {
  temGestao: boolean;
  admin: boolean;
}) {
  const pathname = usePathname();
  const { pessoa } = useAcesso();
  // Funcionário só vê os módulos que o dono liberou; Ajustes (configurações) é de todos.
  const lista = (admin ? [...itens, itemAdmin] : itens).filter((item) => podeAcessarRota(pessoa, item.href));

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-sidebar/95 backdrop-blur supports-[backdrop-filter]:bg-sidebar/85 md:hidden">
      <ul className="flex overflow-x-auto">
        {lista.map(({ href, rotulo, Icone, tambem = [], gestao }) => {
          const ativo =
            pathname === href ||
            pathname.startsWith(`${href}/`) ||
            tambem.some(
              (prefixo) =>
                pathname === prefixo || pathname.startsWith(`${prefixo}/`),
            );
          const bloqueado = gestao && !temGestao;
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className={cn(
                  "flex min-w-[72px] flex-col items-center gap-1 px-2 py-3 text-[11px] font-medium transition-colors",
                  ativo ? "text-primary" : "text-muted",
                  bloqueado && "opacity-50",
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
