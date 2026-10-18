import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/layout/Logo";
import { PARAMETRO_CONVITE } from "@/lib/convite";
import { CriarContaForm } from "./CriarContaForm";

export const metadata: Metadata = {
  title: "Criar conta",
};

export default async function CriarContaPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // Link de convite de outra empresa (/criar-conta?convite=…). Aqui só se limita o tamanho; quem decide se o código vale é o servidor.
  const convite = (await searchParams)[PARAMETRO_CONVITE];
  const codigoConvite = typeof convite === "string" ? convite.slice(0, 40) : undefined;

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
        <p className="text-sm text-muted">Para empresas, prestadores de serviços e autônomos. 30 dias grátis para começar.</p>
      </div>

      <CriarContaForm codigoConvite={codigoConvite} />
    </main>
  );
}
