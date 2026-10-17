import type { ReactNode } from "react";
import { exigirSessao, obterRecursosDaEmpresa } from "@/lib/auth/dal";
import { temAlgumModulo } from "@/lib/auth/modulos";
import { SemAcessoModulo } from "@/components/layout/SemAcessoModulo";
import { AbasRede } from "@/components/rede/AbasRede";
import { PageHeader } from "@/components/layout/PageHeader";
import { MARCA } from "@/lib/marca";

export default async function MinhaRedeLayout({ children }: { children: ReactNode }) {
  const sessao = await exigirSessao();
  // O Elo Profissionais é um módulo: o funcionário só entra se o dono o liberou.
  if (!temAlgumModulo(sessao, ["rede"])) {
    return <SemAcessoModulo pessoa={sessao} recursos={await obterRecursosDaEmpresa(sessao.empresaId)} />;
  }
  return (
    <div className="animar-entrada">
      <PageHeader titulo={MARCA.produtos.profissionais.nome} />
      <AbasRede />
      {children}
    </div>
  );
}
