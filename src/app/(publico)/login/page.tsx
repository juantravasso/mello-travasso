import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/layout/Logo";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Entrar",
};

export default function LoginPage() {
  return (
    <main className="flex min-h-svh flex-col justify-center bg-background px-6 py-12 sm:px-[8vw]">
      <div className="flex w-full max-w-[440px] flex-col gap-8">
        <Logo tamanho="md" />

        <div className="flex flex-col gap-1">
          <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.01em] text-foreground">Entrar</h1>
          <p className="text-sm text-muted">Acesse o Elo Gestão e o Elo Profissionais.</p>
        </div>

        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>

        <div className="flex flex-col gap-3 border-t border-border pt-6">
          <p className="text-sm text-muted">Ainda não tem cadastro?</p>
          <Link
            href="/criar-conta"
            className="inline-flex h-11 w-full items-center justify-center rounded-lg border border-border bg-transparent px-4 text-base font-medium text-foreground transition-colors hover:bg-surface-2"
          >
            Criar conta
          </Link>
        </div>
      </div>
    </main>
  );
}
