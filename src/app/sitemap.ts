import type { MetadataRoute } from "next";
import { listarSlugsPublicados } from "@/services/data/server/redeCore.server";
import { urlDoSite } from "@/lib/rede/site";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = urlDoSite();
  const perfis = await listarSlugsPublicados();
  return [
    { url: `${base}/rede`, changeFrequency: "daily", priority: 0.8 },
    ...perfis.map((p) => ({
      url: `${base}/empresas/${p.slug}`,
      lastModified: p.atualizadoEm,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}
