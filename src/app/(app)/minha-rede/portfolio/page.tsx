import type { Metadata } from "next";
import { PortfolioEditor } from "@/components/rede/PortfolioEditor";

export const metadata: Metadata = { title: "Portfólio e serviços | Mello e Travasso" };

export default function PortfolioPage() {
  return <PortfolioEditor />;
}
