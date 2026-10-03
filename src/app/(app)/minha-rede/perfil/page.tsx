import type { Metadata } from "next";
import { PerfilForm } from "@/components/rede/PerfilForm";

export const metadata: Metadata = { title: "Meu perfil público | Mello e Travasso" };

export default function MeuPerfilPage() {
  return (
    <div className="max-w-2xl">
      <PerfilForm />
    </div>
  );
}
