import type { ReactNode } from "react";
import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { exigirSessao, obterRecursosDaEmpresa, obterStatusPlano, perfilObrigatorioPendente } from "@/lib/auth/dal";
import { ROTA_DO_PERFIL, rotaLiberadaSemPerfil } from "@/lib/perfilObrigatorio";
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

  const [statusPlano, recursos, perfilPendente] = await Promise.all([
    obterStatusPlano(sessao.empresaId),
    obterRecursosDaEmpresa(sessao.empresaId),
    perfilObrigatorioPendente(sessao.empresaId, sessao.papel, sessao.admin),
  ]);

  // Depois do cadastro o responsável publica o perfil no Elo Profissionais antes de usar o resto. Aqui cobre quem abre
  // a tela direto (link, favorito, recarregar); a navegação dentro do app é coberta por GuardaPerfilObrigatorio, porque
  // o layout não roda de novo a cada troca de tela, e as ações da gestão recusam no servidor (exigirGestaoAction).
  if (perfilPendente) {
    const caminho = (await headers()).get("x-pathname");
    if (caminho && !rotaLiberadaSemPerfil(caminho)) redirect(ROTA_DO_PERFIL);
  }

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
      perfilPendente={perfilPendente}
    >
      {children}
    </ShellWrapper>
  );
}
