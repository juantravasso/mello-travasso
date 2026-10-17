import type { ReactNode } from "react";
import { Suspense } from "react";
import { exigirSessao, obterRecursosDaEmpresa, obterStatusPlano } from "@/lib/auth/dal";
import { Logo } from "@/components/layout/Logo";
import { SairButton } from "@/components/layout/SairButton";
import { ShellWrapper } from "@/components/layout/ShellWrapper";
import { TrocarSenhaForm } from "@/components/layout/TrocarSenhaForm";

// Barreira real de autenticação: todas as rotas dentro de (app) passam por
// aqui. proxy.ts só faz a checagem otimista do cookie; exigirSessao() é quem
// de fato confere a sessão no banco e redireciona para /login quando não há.
export default async function AppLayout({ children }: { children: ReactNode }) {
  // Sem `next=` aqui: layouts não recebem o pathname atual diretamente. O
  // caso comum (sem cookie) já é resolvido por proxy.ts, que sabe a rota e
  // seta ?next= antes de chegar aqui; este redirect só cobre o caso raro de
  // cookie presente porém sessão inválida no banco (expirada/apagada).
  const sessao = await exigirSessao();

  // Entrou com a senha temporária que o responsável da empresa definiu: antes de qualquer tela, precisa
  // escolher uma senha própria. É o layout que decide (vale para toda rota de (app), sem depender de
  // redirecionamento); as ações e APIs também recusam enquanto a troca estiver pendente (exigirSessaoAction).
  if (sessao.trocaSenhaPendente) {
    return (
      <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-6 px-6 py-12">
        <Logo tamanho="md" />
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-[-0.01em] text-foreground">Escolha a sua senha</h1>
          <p className="text-sm text-muted">
            Olá, {sessao.nome.split(" ")[0]}. Para proteger a sua conta, troque a senha temporária por uma só sua antes de continuar.
          </p>
        </div>
        <Suspense fallback={null}>
          <TrocarSenhaForm bloqueante />
        </Suspense>
        <SairButton />
      </main>
    );
  }

  const [statusPlano, recursos] = await Promise.all([
    obterStatusPlano(sessao.empresaId),
    obterRecursosDaEmpresa(sessao.empresaId),
  ]);

  return (
    <ShellWrapper
      nomeUsuario={sessao.nome}
      statusPlano={statusPlano}
      temGestao={recursos.has("gestao")}
      admin={sessao.admin}
      emailConfirmado={sessao.emailConfirmado}
      emailUsuario={sessao.email}
      papel={sessao.papel}
      modulos={sessao.modulos}
    >
      {children}
    </ShellWrapper>
  );
}
