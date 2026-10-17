import type { Metadata } from "next";
import Link from "next/link";
import { buscarPerfisPublicos, listarTaxonomia } from "@/services/data/server/redeCore.server";
import { SIGLAS_UF } from "@/lib/rede/ufs";
import { RAIOS_KM } from "@/lib/rede/raios";
import type { FiltrosBuscaPerfil } from "@/types";
import { BuscaRedeForm } from "@/components/rede/BuscaRedeForm";
import { PerfilItem } from "@/components/rede/PerfilItem";
import { Card } from "@/components/ui/Card";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function primeiro(valor: string | string[] | undefined): string | undefined {
  const v = Array.isArray(valor) ? valor[0] : valor;
  return v && v.trim() !== "" ? v.trim() : undefined;
}

function lerNotaMin(valor: string | undefined): number | undefined {
  const nota = Number.parseFloat((valor ?? "").replace(",", "."));
  return Number.isFinite(nota) && nota >= 1 && nota <= 5 ? nota : undefined;
}

function lerRaio(valor: string | undefined): number | undefined {
  const km = Number.parseInt(valor ?? "", 10);
  return (RAIOS_KM as readonly number[]).includes(km) ? km : undefined;
}

function lerFiltros(params: Record<string, string | string[] | undefined>): FiltrosBuscaPerfil {
  const estado = primeiro(params.estado)?.toUpperCase();
  const tipo = primeiro(params.tipo);
  const pagina = Number.parseInt(primeiro(params.pagina) ?? "1", 10);
  return {
    q: primeiro(params.q)?.slice(0, 80),
    profissao: primeiro(params.profissao)?.slice(0, 80),
    categoria: primeiro(params.categoria)?.slice(0, 80),
    estado: estado && SIGLAS_UF.includes(estado) ? estado : undefined,
    cidade: primeiro(params.cidade)?.slice(0, 100),
    tipo: tipo === "pj" || tipo === "pf" ? tipo : undefined,
    notaMin: lerNotaMin(primeiro(params.notaMin)),
    raioKm: lerRaio(primeiro(params.raioKm)),
    pagina: Number.isFinite(pagina) && pagina >= 1 ? Math.min(pagina, 500) : 1,
  };
}

function hrefPagina(filtros: FiltrosBuscaPerfil, pagina: number): string {
  const params = new URLSearchParams();
  for (const [chave, valor] of Object.entries(filtros)) {
    if (chave === "pagina" || valor === undefined || valor === "") continue;
    params.set(chave, String(valor));
  }
  if (pagina > 1) params.set("pagina", String(pagina));
  const texto = params.toString();
  return texto ? `/rede/buscar?${texto}` : "/rede/buscar";
}

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const filtros = lerFiltros(await searchParams);
  const temFiltro = Boolean(filtros.q || filtros.profissao || filtros.categoria || filtros.estado || filtros.cidade || filtros.tipo || filtros.notaMin);
  return {
    title: "Resultados da pesquisa",
    description: "Empresas e profissionais da construção civil e de serviços.",
    // Cada combinação de filtros é uma URL própria: só a listagem sem filtro é indexada.
    robots: temFiltro || (filtros.pagina ?? 1) > 1 ? { index: false, follow: true } : undefined,
    alternates: { canonical: "/rede/buscar" },
  };
}

export default async function BuscarPage({ searchParams }: { searchParams: SearchParams }) {
  const filtros = lerFiltros(await searchParams);
  const [taxonomia, resultado] = await Promise.all([listarTaxonomia(false), buscarPerfisPublicos(filtros)]);
  const temFiltro = Boolean(filtros.q || filtros.profissao || filtros.categoria || filtros.estado || filtros.cidade || filtros.tipo || filtros.notaMin);

  return (
    <div className="flex flex-col gap-6 animar-entrada">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-foreground">Encontrar profissionais e empresas</h1>
        <p className="text-sm text-muted" aria-live="polite">
          {resultado.limiteExcedido
            ? "Muitas pesquisas em pouco tempo."
            : resultado.total === 1
              ? "1 resultado"
              : `${resultado.total} resultados`}
        </p>
        {resultado.raio && (
          <p className="text-sm text-muted">
            Até {resultado.raio.km} km de {resultado.raio.cidade}/{resultado.raio.estado}, do mais perto ao mais longe. A distância é
            em linha reta entre o centro das cidades.
          </p>
        )}
        {resultado.raioIgnorado && (
          <p role="status" className="text-sm text-warning">
            Não encontramos essa cidade na lista de municípios do estado, então buscamos só pelo nome. Confira a grafia para buscar por
            distância.
          </p>
        )}
      </div>

      <Card className="p-4 sm:p-5">
        <BuscaRedeForm key={JSON.stringify(filtros)} taxonomia={taxonomia} inicial={filtros} />
      </Card>

      {resultado.limiteExcedido ? (
        <Card role="alert" className="border-warning bg-warning-bg text-sm text-warning">
          Você fez muitas pesquisas seguidas. Espere um minuto e tente de novo.
        </Card>
      ) : resultado.itens.length === 0 ? (
        <Card className="flex flex-col gap-2 text-sm text-muted">
          <p className="font-medium text-foreground">Nenhum perfil encontrado.</p>
          <p>
            {temFiltro
              ? resultado.raio
                ? "Nenhum perfil nesse raio. Tente aumentar a distância ou tirar algum filtro."
                : "Tente tirar algum filtro ou pesquisar uma cidade próxima."
              : "Ainda não há perfis publicados na rede."}
          </p>
          {temFiltro && (
            <Link href="/rede/buscar" className="w-fit font-medium text-primary underline underline-offset-4">
              Limpar filtros
            </Link>
          )}
        </Card>
      ) : (
        <>
          <ul className="grid gap-3 md:grid-cols-2">
            {resultado.itens.map((perfil) => (
              <PerfilItem key={perfil.slug} perfil={perfil} />
            ))}
          </ul>

          {resultado.totalPaginas > 1 && (
            <nav aria-label="Paginação" className="flex items-center justify-between gap-3 text-sm">
              {resultado.pagina > 1 ? (
                <Link
                  href={hrefPagina(filtros, resultado.pagina - 1)}
                  className="rounded-lg border border-border px-3 py-2 font-medium hover:bg-surface-2"
                >
                  ← Anterior
                </Link>
              ) : (
                <span />
              )}
              <span className="text-muted tabular-nums">
                Página {resultado.pagina} de {resultado.totalPaginas}
              </span>
              {resultado.pagina < resultado.totalPaginas ? (
                <Link
                  href={hrefPagina(filtros, resultado.pagina + 1)}
                  className="rounded-lg border border-border px-3 py-2 font-medium hover:bg-surface-2"
                >
                  Próxima →
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}
        </>
      )}
    </div>
  );
}
