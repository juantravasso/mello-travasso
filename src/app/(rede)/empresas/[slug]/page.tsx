import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { obterPerfilPublicoPorSlug } from "@/services/data/server/redeCore.server";
import { listarAvaliacoesPublicas, obterEstadoInteracao } from "@/services/data/server/avaliacaoCore.server";
import { headers } from "next/headers";
import { obterSessaoOpcional } from "@/lib/auth/dal";
import { extrairIpConfiavel, verificarLimite } from "@/lib/auth/limite";
import { formatarTelefone } from "@/lib/rede/texto";
import { jsonLdSeguro, urlDoSite } from "@/lib/rede/site";
import { AcoesPerfil } from "@/components/rede/AcoesPerfil";
import { SeloVerificado } from "@/components/rede/SeloVerificado";
import { AvaliacaoCard } from "@/components/rede/AvaliacaoCard";
import { DenunciarPerfil } from "@/components/rede/DenunciarPerfil";
import { AvatarIniciais } from "@/components/rede/AvatarIniciais";
import { GaleriaTrabalhos } from "@/components/rede/GaleriaTrabalhos";
import { localizacao } from "@/components/rede/PerfilItem";
import { ResumoNotas } from "@/components/rede/ResumoNotas";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const dados = await obterPerfilPublicoPorSlug(slug);
  if (!dados) return { title: "Perfil não encontrado | Mello e Travasso", robots: { index: false } };
  const perfil = dados.perfil;

  const local = localizacao(perfil);
  const profissoes = perfil.profissoes.join(", ");
  const titulo = [perfil.nome, profissoes || null, local].filter(Boolean).join(" — ");
  const descricao =
    perfil.descricao?.slice(0, 160) ??
    `${perfil.nome}${profissoes ? `: ${profissoes}` : ""}${local ? ` em ${local}` : ""}. Veja contatos e avaliações na rede profissional.`;
  const caminho = `/empresas/${perfil.slug}`;

  return {
    title: `${titulo} | Mello e Travasso`,
    description: descricao,
    // Perfil indicado por terceiros não é indexado: o conteúdo não foi publicado pela própria pessoa.
    robots: perfil.indicado ? { index: false, follow: true } : undefined,
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

export default async function PerfilPublicoPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { slug } = await params;
  // Freio contra raspagem: a página é dinâmica e faz várias consultas por visita.
  const visitas = await verificarLimite(`rede-perfil:${extrairIpConfiavel(await headers())}`, 120, 60_000);
  if (!visitas.permitido) {
    return (
      <Card role="alert" className="mx-auto max-w-lg text-sm text-muted">
        Muitas visitas em pouco tempo. Espere um minuto e tente de novo.
      </Card>
    );
  }
  const consulta = await searchParams;
  const bruto = Array.isArray(consulta.av) ? consulta.av[0] : consulta.av;
  const paginaAvaliacoes = Math.min(Math.max(Number.parseInt(bruto ?? "1", 10) || 1, 1), 500);

  const [dados, sessao] = await Promise.all([obterPerfilPublicoPorSlug(slug), obterSessaoOpcional()]);
  if (!dados) notFound();
  const { perfil } = dados;

  const [estado, avaliacoes] = await Promise.all([
    obterEstadoInteracao(dados, sessao?.empresaId ?? null),
    listarAvaliacoesPublicas(dados.id, perfil.nome, paginaAvaliacoes),
  ]);

  const local = localizacao(perfil);
  const temContato = Boolean(perfil.telefone || perfil.whatsapp || perfil.instagram || perfil.site);

  const jsonLd = perfil.indicado
    ? null
    : {
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
        ...(perfil.tipo === "pj" && perfil.resumo.media !== null
          ? {
              aggregateRating: {
                "@type": "AggregateRating",
                ratingValue: perfil.resumo.media,
                reviewCount: perfil.resumo.total,
                bestRating: 5,
                worstRating: 1,
              },
            }
          : {}),
      };

  const hrefAvaliacoes = (pagina: number) => (pagina > 1 ? `/empresas/${perfil.slug}?av=${pagina}#avaliacoes` : `/empresas/${perfil.slug}#avaliacoes`);

  return (
    <article className="flex flex-col gap-6 animar-entrada">
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdSeguro(jsonLd) }} />}

      <nav aria-label="Navegação" className="text-sm">
        <Link href="/rede" className="text-muted hover:text-foreground">
          ← Encontrar profissionais
        </Link>
      </nav>

      {perfil.indicado && (
        <Card className="border-info bg-info-bg text-sm text-info">
          Esta empresa foi indicada por outras empresas da rede e ainda não tem cadastro. As informações abaixo são
          básicas e não foram preenchidas por ela.{" "}
          <a
            href="mailto:contato@mellotravasso.com.br?subject=Remover%20ou%20corrigir%20p%C3%A1gina%20indicada"
            className="font-medium underline underline-offset-4"
          >
            Não é você, ou quer corrigir ou remover esta página? Fale com a gente.
          </a>{" "}
          <Link
            href={sessao ? `/minha-rede/reivindicar/${perfil.slug}` : `/login?next=${encodeURIComponent(`/minha-rede/reivindicar/${perfil.slug}`)}`}
            className="font-medium underline underline-offset-4"
          >
            É a sua? Reivindique o perfil.
          </Link>
        </Card>
      )}

      <header className="flex items-start gap-4">
        <AvatarIniciais nome={perfil.nome} logoUrl={perfil.logoUrl} className="h-16 w-16 text-xl" />
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="text-2xl font-semibold leading-tight text-foreground sm:text-3xl">{perfil.nome}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tom="neutral">{perfil.tipo === "pj" ? "Empresa" : "Profissional autônomo"}</Badge>
            {perfil.indicado && <Badge tom="info">Indicada pela rede</Badge>}
            {perfil.verificado && <SeloVerificado tipo={perfil.tipo} />}
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
        <div className="flex flex-col gap-8">
          {!perfil.indicado && (
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
          )}

          {perfil.servicos.length > 0 && (
            <section className="flex flex-col gap-3" aria-labelledby="titulo-servicos">
              <h2 id="titulo-servicos" className="text-lg font-semibold text-foreground">
                Serviços oferecidos
              </h2>
              <ul className="grid gap-2 sm:grid-cols-2">
                {perfil.servicos.map((servico) => (
                  <li key={servico.nome} className="rounded-lg border border-border bg-card px-3 py-2">
                    <p className="text-sm font-medium text-foreground">{servico.nome}</p>
                    {servico.descricao && <p className="text-sm text-muted">{servico.descricao}</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {perfil.galerias.length > 0 && (
            <section className="flex flex-col gap-4" aria-labelledby="titulo-portfolio">
              <h2 id="titulo-portfolio" className="text-lg font-semibold text-foreground">
                Trabalhos realizados
              </h2>
              <GaleriaTrabalhos galerias={perfil.galerias} />
            </section>
          )}

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

          {perfil.locais && perfil.locais.length > 0 && (
            <nav className="flex flex-col gap-2" aria-labelledby="titulo-locais">
              <h2 id="titulo-locais" className="text-lg font-semibold text-foreground">
                Veja também na região
              </h2>
              <ul className="flex flex-wrap gap-2">
                {perfil.locais.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="inline-flex rounded-full border border-border px-2.5 py-1 text-sm text-foreground hover:border-primary hover:text-primary">
                      {l.rotulo}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          <section id="avaliacoes" className="flex scroll-mt-20 flex-col gap-4" aria-labelledby="titulo-avaliacoes">
            <h2 id="titulo-avaliacoes" className="text-lg font-semibold text-foreground">
              Avaliações
            </h2>
            <Card>
              <ResumoNotas resumo={perfil.resumo} />
            </Card>

            {avaliacoes.itens.length === 0 ? (
              <p className="text-sm text-muted">
                Ainda não há avaliações. Quem já trabalhou com {perfil.nome} pode ser o primeiro a contar como foi.
              </p>
            ) : (
              <>
                <div className="flex flex-col gap-3">
                  {avaliacoes.itens.map((a) => (
                    <AvaliacaoCard key={a.id} avaliacao={a} slugDoPerfil={perfil.slug} logado={!!sessao} />
                  ))}
                </div>
                {avaliacoes.totalPaginas > 1 && (
                  <nav aria-label="Páginas de avaliações" className="flex items-center justify-between gap-3 text-sm">
                    {avaliacoes.pagina > 1 ? (
                      <Link href={hrefAvaliacoes(avaliacoes.pagina - 1)} className="rounded-lg border border-border px-3 py-2 font-medium hover:bg-surface-2">
                        ← Mais recentes
                      </Link>
                    ) : (
                      <span />
                    )}
                    <span className="text-muted tabular-nums">
                      Página {avaliacoes.pagina} de {avaliacoes.totalPaginas}
                    </span>
                    {avaliacoes.pagina < avaliacoes.totalPaginas ? (
                      <Link href={hrefAvaliacoes(avaliacoes.pagina + 1)} className="rounded-lg border border-border px-3 py-2 font-medium hover:bg-surface-2">
                        Mais antigas →
                      </Link>
                    ) : (
                      <span />
                    )}
                  </nav>
                )}
              </>
            )}
          </section>
        </div>

        <aside className="flex flex-col gap-4">
          <AcoesPerfil slug={perfil.slug} estado={estado} />

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
              <p className="text-sm text-muted">
                {perfil.indicado
                  ? "Esta empresa ainda não tem cadastro, então não há contatos aqui."
                  : "Este perfil não divulga contatos publicamente."}
              </p>
            )}
          </Card>

          <DenunciarPerfil slug={perfil.slug} logado={!!sessao} proprio={estado.proprio} />

          {!sessao && !perfil.indicado && (
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
