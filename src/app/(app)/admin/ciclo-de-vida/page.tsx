import { exigirAdmin } from "@/lib/auth/dal";
import { PageHeader } from "@/components/layout/PageHeader";
import { CicloDeVidaAdmin } from "@/components/admin/CicloDeVidaAdmin";
import { ChamadaConfiguracaoAdmin } from "@/components/admin/ChamadaConfiguracaoAdmin";

export default async function CicloDeVidaAdminPage() {
  await exigirAdmin();
  return (
    <div className="animar-entrada">
      <PageHeader titulo="Teste e e-mails" />
      <div className="flex flex-col gap-6">
        <ChamadaConfiguracaoAdmin />
        <CicloDeVidaAdmin />
      </div>
    </div>
  );
}
