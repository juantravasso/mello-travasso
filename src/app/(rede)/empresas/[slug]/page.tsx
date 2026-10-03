import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { obterPerfilPublicoPorSlug } from "@/services/data/server/redeCore.server";
import { obterSessaoOpcional } from "@/lib/auth/dal";
import { formatarTelefone } from "@/lib/rede/texto";
import { jsonLdSeguro, urlDoSite } from "@/lib/rede/site";
import { AvatarIniciais } from "@/components/rede/AvatarIniciais";
import { localizacao } from "@/components/rede/PerfilItem";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const perfil = await obterPerfilPublicoPorSlug(slug);
  if (!perfil) return { title: "Perfil não encontrado | Mello e Travasso", robots: { index: false } };

  const local = localizacao(perfil);
  const profissoes = perfil.profissoes.join(", ");
  const titulo = [perfil.nome, profissoes || null, local].filter(Boolean).join(" — ");
  const descricao =
    perfil.descricao?.slice(0, 160) ??
    `${perfil.nome}${profissoes ? `: ${profissoes}` : ""}${local ? ` em ${local}` : ""}. Veja contatos e informações na rede profissional.`;
  const caminho = `/empresas/${perfil.slug}`;

  return {
    title: `${titulo} | Mello e Travasso`,
    description: descricao,
    alternates: { canonical: `${urlDoSite()}${caminho}` },
    openGraph: { title: titulo, description: descricao, url: `${urlDoSite()}${caminho}`, type: "profile", locale: "pt_BR" },
    twitter: { card: "summary", title: titulo, description: descricao },
  };
}

function LinhaContato({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border py-2.5 text-sm last:border-0">
      <dt className="text-muted">{rotulo}</dt>
      <dd className="min-w-0 truncate text-right font-medium text-foreground">{children}</dd>
    </div>
  );
}

const classeLink = "text-primary underline-offset-4 hover:underline";

export default async function PerfilPublicoPage({ params }: { params: Params }) {
  const { slug } = await params;
  const [perfil, sessao] = await Promise.all([obterPerfilPublicoPorSlug(slug), obterSessaoOpcional()]);
  if (!perfil) notFound();

  const local = localizacao(perfil);
  const temContato = Boolean(perfil.telefone || perfil.whatsapp || perfil.instagram || perfil.site);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": perfil.tipo === "pj" ? "LocalBusiness" : "Person",
    name: perfil.nome,
    url: `${urlDoSite()}/empresas/${perfil.slug}`,
    ...(perfil.descricao ? { description: perfil.descricao } : {}),
    ...(perfil.cidade || perfil.estado
      ? {
          address: {
            "@type": "PostalAddress",
            ...(perfil.cidade ? { addressLocality: perfil.cidade } : {}),
            ...(perfil.estado ? { addressRegion: perfil.estado } : {}),
            addressCountry: "BR",
          },
        }
      : {}),
    ...(perfil.telefone ? { telephone: `+55${perfil.telefone}` } : {}),
    ...(perfil.profissoes.length > 0 ? { knowsAbout: perfil.profissoes } : {}),
  };

  return (
    <article className="flex flex-col gap-6 animar-entrada">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdSeguro(jsonLd) }} />

      <nav aria-label="Navegação" className="text-sm">
        <Link href="/rede" className="text-muted hover:text-foreground">
          ← Encontrar profissionais
        </Link>
      </nav>

      <header className="flex items-start gap-4">
        <AvatarIniciais nome={perfil.nome} className="h-16 w-16 text-xl" />
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="text-2xl font-semibold leading-tight text-foreground sm:text-3xl">{perfil.nome}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tom="neutral">{perfil.tipo === "pj" ? "Empresa" : "Profissional autônomo"}</Badge>
            {local && <span className="text-sm text-muted">{local}</span>}
          </div>
          {perfil.profissoes.length > 0 && (
            <ul className="flex flex-wrap gap-2" aria-label="Profissões">
              {perfil.profissoesDetalhe.map((p) => (
                <li key={p.slug}>
                  <Link
                    href={`/rede/buscar?profissao=${p.slug}`}
                    className="inline-flex rounded-full border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:border-primary hover:text-primary"
                  >
                    {p.nome}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-2" aria-labelledby="titulo-sobre">
            <h2 id="titulo-sobre" className="text-lg font-semibold text-foreground">
              Sobre
            </h2>
            {perfil.descricao ? (
              <p className="whitespace-pre-line text-foreground/90">{perfil.descricao}</p>
            ) : (
              <p className="text-sm text-muted">Este perfil ainda não tem descrição.</p>
            )}
          </section>

          {(perfil.regiao || perfil.areasAtendimento.length > 0) && (
            <section className="flex flex-col gap-2" aria-labelledby="titulo-atendimento">
              <h2 id="titulo-atendimento" className="text-lg font-semibold text-foreground">
                Onde atende
              </h2>
              {perfil.regiao && <p className="text-sm text-foreground/90">{perfil.regiao}</p>}
              {perfil.areasAtendimento.length > 0 && (
                <ul className="flex flex-wrap gap-2">
                  {perfil.areasAtendimento.map((area) => (
                    <li key={area} className="rounded-md bg-surface-2 px-2.5 py-1 text-sm text-foreground">
                      {area}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>

        <aside className="flex flex-col gap-4">
          <Card className="flex flex-col gap-1">
            <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted">Contato</h2>
            {temContato ? (
              <dl>
                {perfil.telefone && (
                  <LinhaContato rotulo="Telefone">
                    <a href={`tel:+55${perfil.telefone}`} className={classeLink}>
                      {formatarTelefone(perfil.telefone)}
                    </a>
                  </LinhaContato>
                )}
                {perfil.whatsapp && (
                  <LinhaContato rotulo="WhatsApp">
                    <a
                      href={`https://wa.me/55${perfil.whatsapp}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={classeLink}
                    >
                      {formatarTelefone(perfil.whatsapp)}
                    </a>
                  </LinhaContato>
                )}
                {perfil.instagram && (
                  <LinhaContato rotulo="Instagram">
                    <a
                      href={`https://www.instagram.com/${perfil.instagram}`}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className={classeLink}
                    >
                      @{perfil.instagram}
                    </a>
                  </LinhaContato>
                )}
                {perfil.site && (
                  <LinhaContato rotulo="Site">
                    <a href={perfil.site} target="_blank" rel="noopener noreferrer nofollow" className={classeLink}>
                      {new URL(perfil.site).hostname.replace(/^www\./, "")}
                    </a>
                  </LinhaContato>
                )}
              </dl>
            ) : (
              <p className="text-sm text-muted">Este perfil não divulga contatos publicamente.</p>
            )}
          </Card>

          {!sessao && (
            <Card className="flex flex-col gap-2 text-sm">
              <p className="font-medium text-foreground">Tem uma empresa ou trabalha por conta própria?</p>
              <p className="text-muted">Crie seu perfil grátis e apareça nas buscas da rede.</p>
              <Link href="/criar-conta" className="w-fit font-medium text-primary underline underline-offset-4">
                Criar conta grátis
              </Link>
            </Card>
          )}
        </aside>
      </div>
    </article>
  );
}
