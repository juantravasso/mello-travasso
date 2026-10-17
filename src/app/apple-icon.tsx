import { ImageResponse } from "next/og";
import { SimboloImagem } from "@/lib/marcaImagem";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<SimboloImagem lado={180} />, { ...size });
}
