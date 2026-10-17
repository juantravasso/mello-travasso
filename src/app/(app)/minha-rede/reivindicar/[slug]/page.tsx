import type { Metadata } from "next";
import { ReivindicarPerfil } from "@/components/rede/ReivindicarPerfil";

export const metadata: Metadata = { title: "Reivindicar perfil", robots: { index: false, follow: false } };

export default async function ReivindicarPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <ReivindicarPerfil slug={slug} />;
}
