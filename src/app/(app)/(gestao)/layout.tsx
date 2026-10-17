import type { ReactNode } from "react";
import { headers } from "next/headers";
import { exigirSessao, obterRecursosDaEmpresa } from "@/lib/auth/dal";
import { podeAcessarRota, temAlgumModulo } from "@/lib/auth/modulos";
import { SemAcessoModulo } from "@/components/layout/SemAcessoModulo";
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
  // Funcionário sem o módulo desta página: avisa em vez de montar a tela. Sem o cabeçalho do proxy, cai no mínimo
  // seguro (ter algum módulo de gestão); as Server Actions conferem o módulo de cada operação de qualquer jeito.
  const caminho = (await headers()).get("x-pathname");
  const liberado = caminho ? podeAcessarRota(sessao, caminho) : temAlgumModulo(sessao);
  if (!liberado) return <SemAcessoModulo pessoa={sessao} recursos={recursos} />;
  return <>{children}</>;
}
