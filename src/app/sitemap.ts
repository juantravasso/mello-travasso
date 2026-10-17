import type { MetadataRoute } from "next";
import { listarLocaisIndexaveis, listarSlugsPublicados } from "@/services/data/server/redeCore.server";
import { urlDoSite } from "@/lib/rede/site";

export const dynamic = "force-dynamic";

// Rota pública sem limite por IP: guarda o resultado em memória por alguns minutos para que
// requisições repetidas não reexecutem as consultas pesadas.
const TTL_MS = 10 * 60_000;
let guardado: { em: number; dados: MetadataRoute.Sitemap } | null = null;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (guardado && Date.now() - guardado.em < TTL_MS) return guardado.dados;
  const dados = await montar();
  guardado = { em: Date.now(), dados };
  return dados;
}

async function montar(): Promise<MetadataRoute.Sitemap> {
  const base = urlDoSite();
  const [perfis, locais] = await Promise.all([listarSlugsPublicados(), listarLocaisIndexaveis()]);
  return [
    { url: `${base}/rede`, changeFrequency: "daily", priority: 0.8 },
    ...perfis.map((p) => ({
      url: `${base}/empresas/${p.slug}`,
      lastModified: p.atualizadoEm,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...locais.map((l) => ({
      url: `${base}${l.href}`,
      lastModified: l.atualizadoEm,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
  ];
}
