import type { Metadata } from "next";
import Link from "next/link";
import { obterSessaoOpcional } from "@/lib/auth/dal";
import { MARCA } from "@/lib/marca";
import { ListaFeed } from "@/components/feed/ListaFeed";
import { Card } from "@/components/ui/Card";
import { listarFeed, situacaoNoFeed } from "@/services/data/server/feedCore.server";

export const metadata: Metadata = {
  title: "Comunidade",
  description: `Veja o que empresas e profissionais estão publicando no ${MARCA.produtos.profissionais.nome}: trabalhos, novidades e indicações.`,
  alternates: { canonical: "/feed" },
};

export const dynamic = "force-dynamic";

export default async function FeedPage() {
  const sessao = await obterSessaoOpcional();
  const [situacao, primeira] = await Promise.all([situacaoNoFeed(sessao), listarFeed(sessao, null)]);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] animar-entrada">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        <h1 className="sr-only">Comunidade</h1>

        {situacao.podeInteragir ? (
          <Link
            href="/feed/publicar"
            className="hidden items-center rounded-xl border border-border bg-card px-4 py-3 text-muted transition-colors hover:border-primary/60 hover:bg-surface-2 md:flex"
          >
            Em que você está trabalhando? Compartilhe com a comunidade
          </Link>
        ) : (
          <Card className="flex flex-col gap-1 p-4 text-sm">
            {situacao.logado ? (
              <>
                <strong className="text-foreground">Falta publicar o seu perfil para participar.</strong>
                <span className="text-muted">
                  Com o perfil publicado e o e-mail confirmado, você posta, comenta e curte.{" "}
                  <Link href="/minha-rede/perfil" className="font-medium text-primary underline underline-offset-2">
                    Ir para o perfil
                  </Link>
                </span>
              </>
            ) : (
              <>
                <strong className="text-foreground">A comunidade de quem faz acontecer na obra.</strong>
                <span className="text-muted">
                  Qualquer pessoa pode ler. Para postar, comentar e curtir,{" "}
                  <Link href="/login?next=/feed" className="font-medium text-primary underline underline-offset-2">
                    entre
                  </Link>{" "}
                  ou{" "}
                  <Link href="/criar-conta" className="font-medium text-primary underline underline-offset-2">
                    crie uma conta grátis
                  </Link>
                  .
                </span>
              </>
            )}
          </Card>
        )}

        <ListaFeed inicial={primeira} logado={situacao.logado} podeInteragir={situacao.podeInteragir} />
      </div>

      <aside className="hidden flex-col gap-4 lg:flex">
        <Card className="flex flex-col gap-2 p-4">
          <h2 className="font-semibold text-foreground">Precisa de um profissional?</h2>
          <p className="text-sm text-muted">Busque por profissão, cidade e estado, com avaliações de quem já contratou.</p>
          <Link
            href="/rede"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
          >
            Encontrar profissionais
          </Link>
        </Card>
      </aside>
    </div>
  );
}
