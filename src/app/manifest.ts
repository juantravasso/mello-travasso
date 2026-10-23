import type { MetadataRoute } from "next";
import { CORES_MARCA, MARCA } from "@/lib/marca";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: MARCA.nome,
    short_name: MARCA.nomeCurto,
    description: MARCA.descricao,
    lang: "pt-BR",
    start_url: "/",
    display: "standalone",
    background_color: CORES_MARCA.fundoClaro,
    theme_color: CORES_MARCA.fundoClaro,
    icons: [
      { src: "/icon", sizes: "64x64", type: "image/png" },
      { src: "/icones/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icones/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icones/512-maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
