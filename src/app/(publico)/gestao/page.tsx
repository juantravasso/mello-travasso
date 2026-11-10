import Link from "next/link";
import { Logo } from "@/components/layout/Logo";
import { Rodape } from "@/components/layout/Rodape";
import { MARCA, SLOGAN_INICIO, type ProdutoMarca } from "@/lib/marca";

const areas = Object.values(MARCA.produtos as Record<string, ProdutoMarca>);

export default function LandingPage() {
  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[34rem] opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(var(--color-primary) 1px, transparent 1px), linear-gradient(90deg, var(--color-primary) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage: "linear-gradient(to bottom, black, transparent)",
        }}
      />

      <header className="relative mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-6 py-6 sm:px-8">
        <Logo tamanho="md" />
        <nav aria-label="Conta" className="flex items-center gap-2">
          <Link href="/login" className="inline-flex h-10 items-center rounded-lg px-3 text-sm font-medium text-foreground hover:bg-surface-2">
            Entrar
          </Link>
          <Link
            href="/criar-conta"
            className="hidden h-10 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary-hover sm:inline-flex"
          >
            Criar conta grátis
          </Link>
        </nav>
      </header>

      <main className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col gap-20 px-6 pb-16 pt-10 sm:px-8 sm:pt-16">
        <section className="flex max-w-2xl flex-col gap-6 animar-entrada">
          <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight text-foreground sm:text-6xl">
            {SLOGAN_INICIO} <span className="text-primary">{MARCA.sloganDestaque}</span>
          </h1>
          <p className="max-w-lg text-base text-muted sm:text-lg">{MARCA.descricao}</p>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Link
              href="/criar-conta"
              className="inline-flex h-12 items-center gap-2 rounded-lg bg-primary px-6 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary-hover active:scale-[0.98]"
            >
              Criar conta grátis
              <span aria-hidden>→</span>
            </Link>
            <Link
              href="/rede"
              className="inline-flex h-12 items-center rounded-lg border border-border px-5 text-base font-medium text-foreground transition-colors hover:bg-surface-2"
            >
              Encontrar profissionais
            </Link>
          </div>
        </section>

        <section id="produtos" aria-labelledby="titulo-areas" className="flex scroll-mt-8 flex-col gap-2">
          <h2 id="titulo-areas" className="text-sm font-semibold uppercase tracking-widest text-muted">
            Áreas da plataforma
          </h2>
          <ul>
            {areas.map((area) => (
              <li
                key={area.nome}
                className="grid gap-x-8 gap-y-2 border-t border-border py-6 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]"
              >
                <div className="flex flex-col gap-1">
                  <h3 className={`text-xl font-semibold ${area.disponivel ? "text-foreground" : "text-muted"}`}>{area.nome}</h3>
                  <p className={`text-sm font-medium ${area.disponivel ? "text-primary" : "text-muted"}`}>{area.chamada}</p>
                </div>
                <div className="flex flex-col items-start gap-3">
                  <p className="text-sm text-muted">{area.descricao}</p>
                  {area.disponivel && area.href ? (
                    <Link href={area.href} className="text-sm font-medium text-primary underline-offset-4 hover:underline">
                      {area.acao} →
                    </Link>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-muted-bg px-2.5 py-1 text-xs font-medium text-muted">
                      Em breve
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <Rodape />
    </div>
  );
}
