import type { Metadata } from "next";
import { exigirSessao } from "@/lib/auth/dal";
import { PageHeader } from "@/components/layout/PageHeader";
import { CartaoChamadaConfiguracao } from "@/components/chamada/ChamadaConfiguracao";

export const metadata: Metadata = { title: "Chamada de configuração" };
export const dynamic = "force-dynamic";

export default async function AgendarConfiguracaoPage() {
  await exigirSessao("/agendar-configuracao");
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4 animar-entrada">
      <PageHeader titulo="Chamada de configuração" />
      <CartaoChamadaConfiguracao />
    </div>
  );
}
