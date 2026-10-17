import type { Metadata } from "next";
import { Logo } from "@/components/layout/Logo";
import { ConfirmarEmailForm } from "./ConfirmarEmailForm";

// O token está na URL: sem Referer para outros sites e fora de qualquer índice.
export const metadata: Metadata = {
  title: "Confirmar e-mail",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export default async function ConfirmarEmailPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token } = await searchParams;
  const valor = Array.isArray(token) ? token[0] : token;
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col gap-8 px-6 py-12">
      <Logo tamanho="md" />
      <ConfirmarEmailForm token={valor ?? ""} />
    </main>
  );
}
