import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { urlDoSite } from "@/lib/rede/site";
import { listarPerfisLocais, obterLocalPorSlugs, visitaLocalPermitida } from "@/services/data/server/redeCore.server";
import { PerfilItem } from "@/components/rede/PerfilItem";
import { Card } from "@/components/ui/Card";

export const dynamic = "force-dynamic";

type Params = Promise<{ profissao: string; uf: string; cidade: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function lerPagina(consulta: Record<string, string | string[] | undefined>): number {
  const bruto = Array.isArray(consulta.pagina) ? consulta.pagina[0] : consulta.pagina;
  return Math.min(Math.max(Number.parseInt(bruto ?? "1", 10) || 1, 1), 500);
}

export async function generateMetadata({ params, searchParams }: { params: Params; searchParams: SearchParams }): Promise<Metadata> {
  const { profissao, uf, cidade } = await params;
  // Acima do limite a página mostra só o aviso: não consulta o banco nem vai para o índice.
  if (!(await visitaLocalPermitida())) return { title: "Muitas visitas | Mello e Travasso", robots: { index: false } };
  const local = await obterLocalPorSlugs(profissao, uf, cidade);
  if (!local) return { title: "Página não encontrada | Mello e Travasso", robots: { index: false } };

  const pagina = lerPagina(await searchParams);
  const { total } = await listarPerfisLocais(local, pagina);
  const lugar = `${local.municipio.nome}/${local.municipio.uf}`;
  const titulo = `${local.profissao.nome} em ${lugar}`;
  const caminho = `/rede/${local.profissao.slug}/${uf}/${cidade}`;
  const descricao =
    total > 0
      ? `${total === 1 ? "1 empresa ou profissional" : `${total} empresas e profissionais`} de ${local.profissao.nome.toLowerCase()} em ${lugar}, com avaliações de quem já contratou.`
      : `Empresas e profissionais de ${local.profissao.nome.toLowerCase()} em ${lugar} na rede Mello e Travasso.`;

  return {
    title: `${titulo} | Mello e Travasso`,
    description: descricao,
    // Página sem perfil publicado ou além da primeira não vai para o índice (conteúdo fino/duplicado).
    robots: total === 0 || pagina > 1 ? { index: false, follow: true } : undefined,
    alternates: { canonical: `${urlDoSite()}${caminho}` },
    openGraph: { title: titulo, description: descricao, url: `${urlDoSite()}${caminho}`, type: "website", locale: "pt_BR" },
  };
}

export default async function LocalPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { profissao, uf, cidade } = await params;
  if (!(await visitaLocalPermitida())) {
    return (
      <Card role="alert" className="mx-auto max-w-lg text-sm text-muted">
        Muitas visitas em pouco tempo. Espere um minuto e tente de novo.
      </Card>
    );
  }
  const local = await obterLocalPorSlugs(profissao, uf, cidade);
  if (!local) notFound();

  const pagina = lerPagina(await searchParams);
  const { itens, total, totalPaginas } = await listarPerfisLocais(local, pagina);
  if (total > 0 && pagina > totalPaginas) notFound();
  const lugar = `${local.municipio.nome}/${local.municipio.uf}`;
  const base = `/rede/${local.profissao.slug}/${uf}/${cidade}`;
  const hrefPagina = (p: number) => (p > 1 ? `${base}?pagina=${p}` : base);
  const paramsBusca = new URLSearchParams({
    profissao: local.profissao.slug,
    estado: local.municipio.uf,
    cidade: local.municipio.nome,
    raioKm: "50",
  });

  return (
    <div className="flex flex-col gap-6 animar-entrada">
      <nav aria-label="Navegação" className="text-sm">
        <Link href="/rede" className="text-muted hover:text-foreground">
          ← Encontrar profissionais
        </Link>
      </nav>

      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-foreground">
          {local.profissao.nome} em {lugar}
        </h1>
        <p className="text-sm text-muted">
          {total === 0
            ? "Nenhum perfil publicado ainda."
            : total === 1
              ? "1 empresa ou profissional publicado na rede."
              : `${total} empresas e profissionais publicados na rede.`}
        </p>
      </header>

      {itens.length === 0 ? (
        <Card className="flex flex-col gap-2 text-sm text-muted">
          <p className="font-medium text-foreground">
            Ainda não há {local.profissao.nome.toLowerCase()} publicado em {lugar}.
          </p>
          <Link href={`/rede/buscar?${paramsBusca.toString()}`} className="w-fit font-medium text-primary underline underline-offset-4">
            Ver {local.profissao.nome.toLowerCase()} em até 50 km
          </Link>
        </Card>
      ) : (
        <>
          <ul className="grid gap-3 md:grid-cols-2">
            {itens.map((perfil) => (
              <PerfilItem key={perfil.slug} perfil={perfil} />
            ))}
          </ul>

          {totalPaginas > 1 && (
            <nav aria-label="Paginação" className="flex items-center justify-between gap-3 text-sm">
              {pagina > 1 ? (
                <Link href={hrefPagina(pagina - 1)} className="rounded-lg border border-border px-3 py-2 font-medium hover:bg-surface-2">
                  ← Anterior
                </Link>
              ) : (
                <span />
              )}
              <span className="text-muted tabular-nums">
                Página {pagina} de {totalPaginas}
              </span>
              {pagina < totalPaginas ? (
                <Link href={hrefPagina(pagina + 1)} className="rounded-lg border border-border px-3 py-2 font-medium hover:bg-surface-2">
                  Próxima →
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}

          <p className="text-sm text-muted">
            Não achou o que procurava?{" "}
            <Link href={`/rede/buscar?${paramsBusca.toString()}`} className="font-medium text-primary underline underline-offset-4">
              Ver {local.profissao.nome.toLowerCase()} em até 50 km
            </Link>
            .
          </p>
        </>
      )}
    </div>
  );
}
