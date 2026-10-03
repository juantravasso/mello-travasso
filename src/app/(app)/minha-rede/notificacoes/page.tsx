import type { Metadata } from "next";
import { NotificacoesLista } from "@/components/rede/NotificacoesLista";

export const metadata: Metadata = { title: "Notificações | Mello e Travasso" };

export default function NotificacoesPage() {
  return <NotificacoesLista />;
}
