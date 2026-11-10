import type { Metadata } from "next";
import Link from "next/link";
import { listarPerfisRecentes, listarTaxonomia } from "@/services/data/server/redeCore.server";
import { obterSessaoOpcional } from "@/lib/auth/dal";
import { MARCA } from "@/lib/marca";
import { BuscaRedeForm } from "@/components/rede/BuscaRedeForm";
import { PerfilItem } from "@/components/rede/PerfilItem";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = {
  title: "Encontrar profissionais e empresas",
  description:
    `Pesquise empresas e profissionais de construção civil, serviços e tecnologia por profissão, cidade e estado. Veja perfis, avaliações e trabalhos no ${MARCA.produtos.profissionais.nome}.`,
  alternates: { canonical: "/rede" },
};

export const dynamic = "force-dynamic";

export default async function RedeInicioPage() {
  const [taxonomia, recentes, sessao] = await Promise.all([
    listarTaxonomia(false),
    listarPerfisRecentes(6),
    obterSessaoOpcional(),
  ]);
  const categoriasRaiz = taxonomia.filter((c) => !c.paiId);

  return (
    <div className="flex flex-col gap-10 animar-entrada">
      <section className="flex flex-col gap-3">
        <div className="flex max-w-2xl flex-col gap-2">
          <h1 className="text-2xl font-semibold leading-tight text-foreground sm:text-3xl">
            Ache quem faz o serviço, <span className="text-primary">perto de você.</span>
          </h1>
          <p className="text-sm text-muted">
            Empresas e profissionais de construção civil, serviços e tecnologia, com avaliações de quem já contratou. A consulta é aberta a todos.
          </p>
        </div>
        <Card className="p-3 sm:p-4">
          <BuscaRedeForm taxonomia={taxonomia} />
        </Card>
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="titulo-recentes">
        <div className="flex items-end justify-between gap-3 border-b-2 border-primary pb-2">
          <h2 id="titulo-recentes" className="text-2xl font-bold text-foreground">
            Perfis recentes
          </h2>
          <Link href="/rede/buscar" className="text-sm font-semibold text-primary hover:underline">
            Ver todos
          </Link>
        </div>
        {recentes.length > 0 ? (
          <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2">
            {recentes.map((perfil) => (
              <PerfilItem key={perfil.slug} perfil={perfil} />
            ))}
          </ul>
        ) : (
          <Card className="flex flex-col gap-3 text-sm text-muted">
            <p>Ainda não há perfis publicados. O primeiro pode ser o seu.</p>
            <Link
              href={sessao ? "/minha-rede/perfil" : "/criar-conta"}
              className="w-fit font-medium text-primary underline underline-offset-4"
            >
              {sessao ? "Montar meu perfil" : "Criar conta grátis e montar meu perfil"}
            </Link>
          </Card>
        )}
      </section>
      {categoriasRaiz.length > 0 && (
        <details className="group rounded-lg border border-border bg-surface">
          <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-sm font-medium text-foreground">
            Navegar por categoria
            <span aria-hidden className="text-muted transition-transform group-open:rotate-180">⌄</span>
          </summary>
          <div className="flex flex-col gap-3 border-t border-border p-3">
            {categoriasRaiz.map((categoria) => {
              const profissoes = [
                ...categoria.profissoes,
                ...taxonomia.filter((c) => c.paiId === categoria.id).flatMap((c) => c.profissoes),
              ];
              return (
                <div key={categoria.id} className="flex flex-col gap-1.5">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{categoria.nome}</h3>
                  <ul className="flex flex-wrap gap-1.5">
                    {profissoes.map((p) => (
                      <li key={p.id}>
                        <Link
                          href={`/rede/buscar?profissao=${p.slug}`}
                          className="inline-flex rounded-full border border-border bg-card px-2.5 py-1 text-xs text-foreground hover:border-primary hover:text-primary"
                        >
                          {p.nome}
                        </Link>
                      </li>
                    ))}
                    {profissoes.length === 0 && <li className="text-xs text-muted">Em breve.</li>}
                  </ul>
                </div>
              );
            })}
          </div>
        </details>
      )}
    </div>
  );
}
