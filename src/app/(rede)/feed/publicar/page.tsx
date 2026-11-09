import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { obterSessaoOpcional } from "@/lib/auth/dal";
import { FormPostagem } from "@/components/feed/FormPostagem";
import { Card } from "@/components/ui/Card";
import { perfilDaEmpresa, situacaoNoFeed } from "@/services/data/server/feedCore.server";

export const metadata: Metadata = { title: "Nova postagem", robots: { index: false } };

export const dynamic = "force-dynamic";

export default async function PublicarPage() {
  const sessao = await obterSessaoOpcional();
  if (!sessao) redirect("/login?next=/feed/publicar");

  const situacao = await situacaoNoFeed(sessao);
  const perfil = await perfilDaEmpresa(sessao.empresaId);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 animar-entrada">
      <h1 className="text-2xl font-semibold text-foreground">Nova postagem</h1>
      {situacao.podeInteragir && perfil ? (
        <FormPostagem nomeDoPerfil={perfil.nome} />
      ) : (
        <Card className="flex flex-col gap-2 p-5 text-sm">
          <strong className="text-foreground">Para publicar, falta publicar o seu perfil.</strong>
          <span className="text-muted">
            É preciso ter o e-mail confirmado e o perfil publicado no Elo Profissionais, porque a postagem sai com o nome do perfil.
          </span>
          <Link
            href="/minha-rede/perfil"
            className="mt-1 inline-flex h-10 w-fit items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
          >
            Ir para o perfil
          </Link>
        </Card>
      )}
    </div>
  );
}
