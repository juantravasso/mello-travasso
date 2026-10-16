import type { Metadata } from "next";
import { ComprovarRelacao } from "@/components/rede/ComprovarRelacao";

export const metadata: Metadata = { title: "Comprovar relação | Mello e Travasso", robots: { index: false, follow: false } };

export default async function ComprovarPage({ params }: { params: Promise<{ avaliacaoId: string }> }) {
  const { avaliacaoId } = await params;
  return <ComprovarRelacao avaliacaoId={avaliacaoId} />;
}
