import type { ReactNode } from "react";
import { AbasRede } from "@/components/rede/AbasRede";
import { PageHeader } from "@/components/layout/PageHeader";

export default function MinhaRedeLayout({ children }: { children: ReactNode }) {
  return (
    <div className="animar-entrada">
      <PageHeader titulo="Rede profissional" />
      <AbasRede />
      {children}
    </div>
  );
}
