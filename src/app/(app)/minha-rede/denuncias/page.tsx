import type { Metadata } from "next";
import { DenunciasPainel } from "@/components/rede/DenunciasPainel";

export const metadata: Metadata = { title: "Minhas denúncias" };

export default function DenunciasPage() {
  return <DenunciasPainel />;
}
