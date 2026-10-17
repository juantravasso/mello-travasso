import type { Metadata } from "next";
import { Logo } from "@/components/layout/Logo";
import { EsqueciSenhaForm } from "./EsqueciSenhaForm";

export const metadata: Metadata = {
  title: "Esqueci minha senha",
  robots: { index: false, follow: false },
};

export default function EsqueciSenhaPage() {
  return (
    <main className="flex min-h-svh flex-col justify-center bg-background px-6 py-12 sm:px-[8vw]">
      <div className="flex w-full max-w-[440px] flex-col gap-8">
        <Logo tamanho="md" />
        <EsqueciSenhaForm />
      </div>
    </main>
  );
}
