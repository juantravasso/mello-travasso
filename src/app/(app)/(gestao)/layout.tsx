import type { ReactNode } from "react";
import { exigirSessao, obterRecursosDaEmpresa } from "@/lib/auth/dal";
import { UpsellGestao } from "@/components/rede/UpsellGestao";

// Módulos de gestão (projetos, contas, estoque…). Empresa do plano gratuito vê
// uma apresentação dos módulos em vez da página. Isto é só a experiência: a
// barreira real está nas Server Actions (exigirGestaoAction no DAL).
export default async function GestaoLayout({ children }: { children: ReactNode }) {
  const sessao = await exigirSessao();
  const recursos = await obterRecursosDaEmpresa(sessao.empresaId);
  if (!recursos.has("gestao")) {
    return <UpsellGestao podeIniciarTeste={sessao.papel === "dono"} />;
  }
  return <>{children}</>;
}
