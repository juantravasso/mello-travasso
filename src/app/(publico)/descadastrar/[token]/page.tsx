import type { Metadata } from "next";
import { Logo } from "@/components/layout/Logo";
import { DescadastrarForm } from "./DescadastrarForm";

// O token está na URL: sem Referer para outros sites e fora de qualquer índice. A página não consulta o banco, então
// é igual para token válido e inválido (o link não serve para descobrir quem tem conta).
export const metadata: Metadata = {
  title: "Parar de receber dicas",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export default async function DescadastrarPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col gap-8 px-6 py-12">
      <Logo tamanho="md" />
      <DescadastrarForm token={token} />
    </main>
  );
}
