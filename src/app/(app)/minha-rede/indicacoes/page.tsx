import type { Metadata } from "next";
import { IndicacoesPainel } from "@/components/rede/IndicacoesPainel";

export const metadata: Metadata = { title: "Minhas indicações | Mello e Travasso" };

export default function IndicacoesPage() {
  return <IndicacoesPainel />;
}
