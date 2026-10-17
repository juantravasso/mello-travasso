import Link from "next/link";
import { MARCA, type ProdutoMarca } from "@/lib/marca";

// Só áreas que existem entram como link; as futuras aparecem como texto, sem rota.
const produtosDisponiveis = Object.values(MARCA.produtos as Record<string, ProdutoMarca>).filter((p) => p.disponivel && p.href);

/** Rodapé institucional: marca principal, áreas disponíveis e páginas legais. */
export function Rodape({ larguraMaxima = "max-w-5xl" }: { larguraMaxima?: string }) {
  return (
    <footer className="border-t border-border">
      <div className={`mx-auto flex ${larguraMaxima} flex-col gap-4 px-4 py-6 text-xs text-muted sm:px-6 md:flex-row md:items-center md:justify-between`}>
        <div className="flex flex-col gap-0.5">
          <span className="font-medium text-foreground">{MARCA.nome}</span>
          <span>{MARCA.slogan}</span>
        </div>
        <nav aria-label="Rodapé" className="flex flex-wrap gap-x-5 gap-y-2">
          {produtosDisponiveis.map((p) => (
            <Link key={p.nome} href={p.href as string} className="hover:text-foreground">
              {p.nome}
            </Link>
          ))}
          <Link href="/termos" className="hover:text-foreground">
            Termos
          </Link>
          <Link href="/privacidade" className="hover:text-foreground">
            Privacidade
          </Link>
        </nav>
      </div>
    </footer>
  );
}
