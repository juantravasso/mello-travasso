import type { Metadata } from "next";
import { PerfilForm } from "@/components/rede/PerfilForm";
import { ChecklistAtivacao } from "@/components/onboarding/ChecklistAtivacao";

export const metadata: Metadata = { title: "Meu perfil público" };

export default function MeuPerfilPage() {
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <ChecklistAtivacao modo="painel" />
      <PerfilForm />
    </div>
  );
}
