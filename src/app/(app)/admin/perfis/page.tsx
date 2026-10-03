import { exigirAdmin } from "@/lib/auth/dal";
import { PageHeader } from "@/components/layout/PageHeader";
import { PerfisAdmin } from "@/components/admin/PerfisAdmin";

export default async function PerfisAdminPage() {
  await exigirAdmin();
  return (
    <div className="animar-entrada">
      <PageHeader titulo="Perfis da rede" />
      <PerfisAdmin />
    </div>
  );
}
