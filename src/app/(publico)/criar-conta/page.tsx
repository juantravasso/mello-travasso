import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/layout/Logo";
import { CriarContaForm } from "./CriarContaForm";

export const metadata: Metadata = {
  title: "Criar conta | Mello e Travasso",
};

export default function CriarContaPage() {
  return (
    <main className="mx-auto flex min-h-svh max-w-3xl flex-col gap-8 px-6 py-12 sm:px-[6vw]">
      <div className="flex items-center justify-between">
        <Logo tamanho="md" />
        <Link href="/login" className="text-sm font-medium text-muted underline-offset-4 hover:text-foreground hover:underline">
          Já tenho conta
        </Link>
      </div>

      <div className="flex flex-col gap-1">
        <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.01em] text-foreground">Criar conta</h1>
        <p className="text-sm text-muted">Empresa ou autônomo da construção — 30 dias grátis para começar.</p>
      </div>

      <CriarContaForm />
    </main>
  );
}
