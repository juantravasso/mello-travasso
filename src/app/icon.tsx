import { ImageResponse } from "next/og";
import { SimboloImagem } from "@/lib/marcaImagem";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(<SimboloImagem lado={64} />, { ...size });
}
