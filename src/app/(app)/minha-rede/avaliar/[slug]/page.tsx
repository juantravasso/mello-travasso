import type { Metadata } from "next";
import { AvaliacaoForm } from "@/components/rede/AvaliacaoForm";

export const metadata: Metadata = { title: "Avaliar perfil" };

export default async function AvaliarPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <AvaliacaoForm slug={slug} />;
}
