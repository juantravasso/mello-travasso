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
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
