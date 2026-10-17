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
          <nav aria-label={MARCA.nome} className="hidden items-center gap-5 sm:flex">
            <Link href="/rede" className="text-sm font-medium text-foreground hover:text-primary">
              Encontrar profissionais
            </Link>
            {(!sessao || temAlgumModulo(sessao)) && (
              <Link href={sessao ? primeiraRotaPermitida(sessao, new Set(["gestao"])) : "/#produtos"} className="text-sm font-medium text-muted hover:text-foreground">
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
    </header>
  );
}
