import type { ReactNode } from "react";
import { exigirSessao, obterRecursosDaEmpresa, obterStatusPlano } from "@/lib/auth/dal";
import { ShellWrapper } from "@/components/layout/ShellWrapper";

// Barreira real de autenticação: todas as rotas dentro de (app) passam por
// aqui. proxy.ts só faz a checagem otimista do cookie; exigirSessao() é quem
// de fato confere a sessão no banco e redireciona para /login quando não há.
export default async function AppLayout({ children }: { children: ReactNode }) {
  // Sem `next=` aqui: layouts não recebem o pathname atual diretamente. O
  // caso comum (sem cookie) já é resolvido por proxy.ts, que sabe a rota e
  // seta ?next= antes de chegar aqui; este redirect só cobre o caso raro de
  // cookie presente porém sessão inválida no banco (expirada/apagada).
  const sessao = await exigirSessao();
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
    >
      {children}
    </ShellWrapper>
  );
}
