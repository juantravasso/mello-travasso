"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconeInicioRede, IconeMais, IconePerfilRede } from "@/components/layout/icones";
import { cn } from "@/lib/cn";

/**
 * Barra de baixo do celular na área da rede social (feed, busca e perfis públicos): Início à esquerda, Publicar no
 * centro e Perfil à direita. A área administrativa tem a sua própria barra (as abas favoritas).
 */
export function NavRedeMobile({ publicarHref, perfilHref }: { publicarHref: string; perfilHref: string }) {
  const caminho = usePathname();
  const inicioAtivo = caminho === "/feed";
  const publicarAtivo = caminho.startsWith("/feed/publicar");
  const perfilAtivo = caminho.startsWith("/empresas/") || caminho.startsWith("/minha-rede");

  const item = "flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors";

  return (
    <nav aria-label="Navegação da comunidade" className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-sidebar/95 backdrop-blur supports-[backdrop-filter]:bg-sidebar/85 md:hidden">
      <ul className="flex items-end pb-[env(safe-area-inset-bottom)]">
        <li className="flex flex-1">
          <Link href="/feed" aria-current={inicioAtivo ? "page" : undefined} className={cn(item, "min-h-14", inicioAtivo ? "text-primary" : "text-muted")}>
            <IconeInicioRede className="h-6 w-6" />
            Início
          </Link>
        </li>
        <li className="flex flex-1 justify-center">
          <Link
            href={publicarHref}
            aria-current={publicarAtivo ? "page" : undefined}
            aria-label="Publicar"
            className="-mt-4 flex flex-col items-center gap-1 text-[11px] font-medium text-muted"
          >
            <span
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md shadow-primary/30 transition-transform active:scale-95",
                publicarAtivo && "ring-2 ring-primary/40 ring-offset-2 ring-offset-background",
              )}
            >
              <IconeMais className="h-6 w-6" />
            </span>
            Publicar
          </Link>
        </li>
        <li className="flex flex-1">
          <Link href={perfilHref} aria-current={perfilAtivo ? "page" : undefined} className={cn(item, "min-h-14", perfilAtivo ? "text-primary" : "text-muted")}>
            <IconePerfilRede className="h-6 w-6" />
            Perfil
          </Link>
        </li>
      </ul>
    </nav>
  );
}
