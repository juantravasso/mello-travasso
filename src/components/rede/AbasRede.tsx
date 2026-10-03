"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const abas = [
  { href: "/minha-rede/perfil", rotulo: "Meu perfil público" },
  { href: "/rede", rotulo: "Encontrar profissionais", externa: true },
] as const;

export function AbasRede() {
  const pathname = usePathname();
  return (
    <nav aria-label="Rede profissional" className="mb-5 flex gap-1 overflow-x-auto border-b border-border">
      {abas.map((aba) => {
        const ativa = pathname === aba.href || pathname.startsWith(`${aba.href}/`);
        return (
          <Link
            key={aba.href}
            href={aba.href}
            aria-current={ativa ? "page" : undefined}
            className={cn(
              "-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
              ativa ? "border-primary text-primary" : "border-transparent text-muted hover:text-foreground",
            )}
          >
            {aba.rotulo}
            {"externa" in aba && <span aria-hidden> ↗</span>}
          </Link>
        );
      })}
    </nav>
  );
}
