import type { Metadata } from "next";
import { AvaliacoesPainel } from "@/components/rede/AvaliacoesPainel";

export const metadata: Metadata = { title: "Minhas avaliações" };

export default async function AvaliacoesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { aba } = await searchParams;
  const valor = Array.isArray(aba) ? aba[0] : aba;
  return <AvaliacoesPainel aba={valor === "feitas" ? "feitas" : "recebidas"} />;
}
