import type { ReactNode } from "react";
import { AbasRede } from "@/components/rede/AbasRede";
import { PageHeader } from "@/components/layout/PageHeader";
import { MARCA } from "@/lib/marca";

export default function MinhaRedeLayout({ children }: { children: ReactNode }) {
  return (
    <div className="animar-entrada">
      <PageHeader titulo={MARCA.produtos.profissionais.nome} />
      <AbasRede />
      {children}
    </div>
  );
}
