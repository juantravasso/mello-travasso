import Link from "next/link";
import { obterSessaoOpcional } from "@/lib/auth/dal";
import { Logo } from "@/components/layout/Logo";
import { primeiraRotaPermitida, temAlgumModulo } from "@/lib/auth/modulos";
import { MARCA } from "@/lib/marca";

export async function RedeHeader() {
  const sessao = await obterSessaoOpcional();

  return (
    <header className="border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-6">
          <Link href="/" aria-label={`${MARCA.nome}: página inicial`}>
            <Logo tamanho="sm" produto="profissionais" />
          </Link>
          <nav aria-label={MARCA.nome} className="hidden items-center gap-3 sm:flex">
            <Link href="/feed" className="inline-flex h-10 items-center whitespace-nowrap rounded-full border border-primary/50 bg-primary/10 px-4 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground">
              Comunidade
            </Link>
            <Link href="/rede" className="inline-flex h-10 items-center whitespace-nowrap rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover">
              Encontrar profissionais
            </Link>
            {(!sessao || temAlgumModulo(sessao)) && (
              <Link href={sessao ? primeiraRotaPermitida(sessao, new Set(["gestao"])) : "/gestao"} className="text-sm font-medium text-muted hover:text-foreground">
                {MARCA.produtos.gestao.nome}
              </Link>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {sessao ? (
            <Link
              href="/minha-rede"
              className="inline-flex h-9 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
            >
              Minha rede
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium text-foreground hover:bg-surface-2"
              >
                Entrar
              </Link>
              <Link
                href="/criar-conta"
                className="inline-flex h-9 items-center whitespace-nowrap rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
              >
                Criar conta<span className="hidden sm:inline">&nbsp;grátis</span>
              </Link>
            </>
          )}
        </div>
      </div>
      {/* No celular a navegação não cabe ao lado do logo: vira uma faixa logo abaixo. */}
      <nav aria-label={`${MARCA.nome} (celular)`} className="mx-auto grid max-w-5xl grid-cols-2 gap-2 px-4 pb-3 sm:hidden">
        <Link href="/feed" className="inline-flex h-10 items-center whitespace-nowrap rounded-full border border-primary/50 bg-primary/10 px-4 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground justify-center">
          Comunidade
        </Link>
        <Link href="/rede" className="inline-flex h-10 items-center whitespace-nowrap rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover justify-center">
          Encontrar profissionais
        </Link>
        {(!sessao || temAlgumModulo(sessao)) && (
          <Link href={sessao ? primeiraRotaPermitida(sessao, new Set(["gestao"])) : "/gestao"} className="col-span-2 py-1 text-center text-sm font-medium text-muted hover:text-foreground">
            {MARCA.produtos.gestao.nome}
          </Link>
        )}
      </nav>
    </header>
  );
}
