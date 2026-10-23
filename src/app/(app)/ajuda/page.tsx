import type { Metadata } from "next";
import { exigirSessao, obterRecursosDaEmpresa } from "@/lib/auth/dal";
import { ajudasDisponiveis } from "@/lib/onboarding/ajuda";
import { PageHeader } from "@/components/layout/PageHeader";
import { CentralDeAjuda } from "@/components/onboarding/CentralDeAjuda";
import { ChecklistAtivacao } from "@/components/onboarding/ChecklistAtivacao";
import { InstalarNoCelular } from "@/components/onboarding/InstalarNoCelular";

export const metadata: Metadata = { title: "Ajuda e tutoriais" };

// Rota livre (sem módulo): todo usuário logado chega aqui. A lista de tutoriais já vem filtrada pelo servidor pelo
// plano da empresa e pelos módulos da pessoa.
export default async function AjudaPage() {
  const sessao = await exigirSessao();
  const recursos = await obterRecursosDaEmpresa(sessao.empresaId);
  const ajudas = ajudasDisponiveis({ papel: sessao.papel, modulos: sessao.modulos }, recursos);
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 animar-entrada">
      <PageHeader titulo="Ajuda e tutoriais" />
      <ChecklistAtivacao modo="ajuda" />
      <CentralDeAjuda ajudas={ajudas} />
      <InstalarNoCelular />
    </div>
  );
}
