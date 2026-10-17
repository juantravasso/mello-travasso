import type { Metadata } from "next";
import { NotificacoesLista } from "@/components/rede/NotificacoesLista";

export const metadata: Metadata = { title: "Notificações" };

export default function NotificacoesPage() {
  return <NotificacoesLista />;
}
