import type { ReactNode } from "react";
import { obterSessaoOpcional } from "@/lib/auth/dal";
import { perfilDaEmpresa } from "@/services/data/server/feedCore.server";
import { Rodape } from "@/components/layout/Rodape";
import { NavRedeMobile } from "@/components/feed/NavRedeMobile";
import { RedeHeader } from "@/components/rede/RedeHeader";

// Páginas públicas da rede profissional e da comunidade: abertas a visitantes, sem a barra
// lateral do app (que pertence a (app)). O cabeçalho muda se há sessão. No celular, a barra de
// baixo é a da rede social (Início, Publicar, Perfil); a das abas favoritas é da área administrativa.
export default async function RedeLayout({ children }: { children: ReactNode }) {
  const sessao = await obterSessaoOpcional();
  const perfil = sessao ? await perfilDaEmpresa(sessao.empresaId) : null;
  const publicarHref = sessao ? "/feed/publicar" : "/login?next=/feed/publicar";
  const perfilHref = !sessao ? "/login?next=/minha-rede/perfil" : perfil?.status === "publicado" ? `/empresas/${perfil.slug}` : "/minha-rede/perfil";

  return (
    <div className="flex min-h-svh flex-col bg-background pb-16 md:pb-0">
      <RedeHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">{children}</main>
      <Rodape />
      <NavRedeMobile publicarHref={publicarHref} perfilHref={perfilHref} />
    </div>
  );
}
