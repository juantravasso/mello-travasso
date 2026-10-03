import type { Metadata } from "next";
import Link from "next/link";
import { listarPerfisRecentes, listarTaxonomia } from "@/services/data/server/redeCore.server";
import { obterSessaoOpcional } from "@/lib/auth/dal";
import { BuscaRedeForm } from "@/components/rede/BuscaRedeForm";
import { PerfilItem } from "@/components/rede/PerfilItem";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = {
  title: "Encontrar profissionais e empresas | Mello e Travasso",
  description:
    "Pesquise empresas e profissionais da construção civil e de serviços por profissão, cidade e estado. Veja perfis, contatos e trabalhos.",
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
      <section className="flex flex-col gap-5">
        <div className="flex max-w-2xl flex-col gap-2">
          <h1 className="text-3xl font-semibold leading-tight text-foreground sm:text-4xl">
            Ache quem faz o serviço, <span className="text-primary">perto da sua obra.</span>
          </h1>
          <p className="text-muted">
            Empresas e profissionais da construção e de serviços, com contato direto. A consulta é aberta a todos.
          </p>
        </div>
        <Card className="p-4 sm:p-5">
          <BuscaRedeForm taxonomia={taxonomia} />
        </Card>
      </section>

      {categoriasRaiz.length > 0 && (
        <section className="flex flex-col gap-4" aria-labelledby="titulo-categorias">
          <h2 id="titulo-categorias" className="text-lg font-semibold text-foreground">
            Por categoria
          </h2>
          <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
            {categoriasRaiz.map((categoria) => {
              const profissoes = [
                ...categoria.profissoes,
                ...taxonomia.filter((c) => c.paiId === categoria.id).flatMap((c) => c.profissoes),
              ];
              return (
                <div key={categoria.id} className="flex flex-col gap-2 border-t border-border pt-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">{categoria.nome}</h3>
                  <ul className="flex flex-col">
                    {profissoes.map((p) => (
                      <li key={p.id}>
                        <Link
                          href={`/rede/buscar?profissao=${p.slug}`}
                          className="block py-1 text-sm text-foreground hover:text-primary"
                        >
                          {p.nome}
                        </Link>
                      </li>
                    ))}
                    {profissoes.length === 0 && <li className="py-1 text-sm text-muted">Em breve.</li>}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-4" aria-labelledby="titulo-recentes">
        <h2 id="titulo-recentes" className="text-lg font-semibold text-foreground">
          Perfis recentes
        </h2>
        {recentes.length > 0 ? (
          <ul className="grid gap-3 md:grid-cols-2">
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
    </div>
  );
}
