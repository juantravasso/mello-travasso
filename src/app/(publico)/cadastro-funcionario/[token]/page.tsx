import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/layout/Logo";
import { consultarConviteFuncionario } from "@/services/data/server/conviteFuncionarioActions";
import { FormCadastroFuncionario } from "./FormCadastroFuncionario";

// Página do link individual enviado pelo dono. Fora dos buscadores e sem repassar o endereço (o token está na URL).
export const metadata: Metadata = {
  title: "Cadastro de funcionário",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export const dynamic = "force-dynamic";

export default async function CadastroFuncionarioPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const convite = await consultarConviteFuncionario(token);

  return (
    <main className="mx-auto flex min-h-svh max-w-xl flex-col gap-6 px-5 py-10 sm:px-6">
      <Logo tamanho="md" />
      {convite.valido ? (
        <>
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold leading-tight text-foreground">Seu cadastro na {convite.empresa}</h1>
            <p className="text-sm text-muted">
              Preencha os seus dados para a empresa concluir o seu cadastro. Leva menos de um minuto. Você não precisa criar conta nem senha.
            </p>
          </div>
          <FormCadastroFuncionario token={token} empresa={convite.empresa} nomeSugerido={convite.nomeSugerido} cargoSugerido={convite.cargoSugerido} />
        </>
      ) : (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
          <h1 className="text-xl font-semibold text-foreground">Este link não está mais disponível</h1>
          <p className="text-sm text-muted">
            Ele pode já ter sido usado, ter vencido (os links valem 7 dias) ou ter sido cancelado. Peça um novo link à empresa.
          </p>
          <Link href="/" className="w-fit text-sm font-medium text-primary underline underline-offset-4">
            Ir para o início
          </Link>
        </div>
      )}
    </main>
  );
}
