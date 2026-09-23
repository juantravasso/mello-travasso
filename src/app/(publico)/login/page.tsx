import type { Metadata } from "next";
import { Suspense } from "react";
import { Logo } from "@/components/layout/Logo";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Entrar | Mello e Travasso",
};

export default function LoginPage() {
  return (
    <main className="flex min-h-svh flex-col justify-center bg-background px-6 py-12 sm:px-[8vw]">
      <div className="flex w-full max-w-[440px] flex-col gap-8">
        <Logo tamanho="md" />

        <div className="flex flex-col gap-1">
          <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.01em] text-foreground">Entrar</h1>
          <p className="text-sm text-muted">Acesse o controle financeiro das suas obras.</p>
        </div>

        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
