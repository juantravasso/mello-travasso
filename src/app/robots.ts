import type { MetadataRoute } from "next";
import { urlDoSite } from "@/lib/rede/site";

export default function robots(): MetadataRoute.Robots {
  return {
    // Só o que é de fato conteúdo de busca. Rotas privadas já exigem sessão;
    // listá-las aqui só serviria de roteiro para quem procura áreas internas.
    rules: [{ userAgent: "*", allow: ["/rede", "/empresas/"], disallow: ["/rede/buscar", "/api/"] }],
    sitemap: `${urlDoSite()}/sitemap.xml`,
  };
}
