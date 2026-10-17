import type { Metadata } from "next";
import { Logo } from "@/components/layout/Logo";
import { RedefinirSenhaForm } from "./RedefinirSenhaForm";

// O token está na URL: sem Referer para outros sites e fora de qualquer índice.
export const metadata: Metadata = {
  title: "Nova senha",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export default async function RedefinirSenhaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token } = await searchParams;
  const valor = Array.isArray(token) ? token[0] : token;
  return (
    <main className="flex min-h-svh flex-col justify-center bg-background px-6 py-12 sm:px-[8vw]">
      <div className="flex w-full max-w-[440px] flex-col gap-8">
        <Logo tamanho="md" />
        <RedefinirSenhaForm token={valor ?? ""} />
      </div>
    </main>
  );
}
