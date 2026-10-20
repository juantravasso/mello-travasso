import { exigirAdmin } from "@/lib/auth/dal";
import { PageHeader } from "@/components/layout/PageHeader";
import { CicloDeVidaAdmin } from "@/components/admin/CicloDeVidaAdmin";

export default async function CicloDeVidaAdminPage() {
  await exigirAdmin();
  return (
    <div className="animar-entrada">
      <PageHeader titulo="Teste e e-mails" />
      <CicloDeVidaAdmin />
    </div>
  );
}
