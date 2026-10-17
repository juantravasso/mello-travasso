import type { Metadata } from "next";
import { PortfolioEditor } from "@/components/rede/PortfolioEditor";

export const metadata: Metadata = { title: "Portfólio e serviços" };

export default function PortfolioPage() {
  return <PortfolioEditor />;
}
