import type { Metadata } from "next";
import { VerificacaoPainel } from "@/components/rede/VerificacaoPainel";

export const metadata: Metadata = { title: "Verificação", robots: { index: false, follow: false } };

export default function VerificacaoPage() {
  return <VerificacaoPainel />;
}
