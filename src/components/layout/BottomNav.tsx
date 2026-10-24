"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { useFavoritos } from "@/hooks/useFavoritos";
import { itemAtivo } from "./navegacao";
import { useItensNavegacao } from "./useItensNavegacao";

/**
 * Barra de baixo do celular: só as abas favoritas (escolhidas com a estrela no menu lateral, pelo hambúrguer). As
 * demais ficam no menu. Sem favoritos salvos, vale o padrão de FAVORITOS_PADRAO.
 */
export function BottomNav({ temGestao, admin }: { temGestao: boolean; admin: boolean }) {
  const pathname = usePathname();
  const itens = useItensNavegacao(admin);
  const { favoritos } = useFavoritos(itens.map((i) => i.href));
  const lista = favoritos.flatMap((href) => itens.find((i) => i.href === href) ?? []);

  return (
    <nav aria-label="Abas favoritas" className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-sidebar/95 backdrop-blur supports-[backdrop-filter]:bg-sidebar/85 md:hidden">
      <ul className="flex">
        {lista.map((item) => {
          const ativo = itemAtivo(item, pathname);
          const bloqueado = item.gestao && !temGestao;
          return (
            <li key={item.href} className="min-w-0 flex-1">
              <Link
                href={item.href}
                aria-current={ativo ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 px-1 py-3 text-[11px] font-medium transition-colors",
                  ativo ? "text-primary" : "text-muted",
                  bloqueado && "opacity-50",
                )}
              >
                <item.Icone className="h-5 w-5" />
                <span className="max-w-full truncate">{item.rotuloCurto}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
