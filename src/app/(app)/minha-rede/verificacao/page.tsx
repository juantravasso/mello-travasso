import type { Metadata } from "next";
import { VerificacaoPainel } from "@/components/rede/VerificacaoPainel";

export const metadata: Metadata = { title: "Verificação | Mello e Travasso", robots: { index: false, follow: false } };

export default function VerificacaoPage() {
  return <VerificacaoPainel />;
}
