import { exigirAdmin } from "@/lib/auth/dal";
import { PageHeader } from "@/components/layout/PageHeader";
import { PlanosAdmin } from "@/components/admin/PlanosAdmin";

export default async function PlanosAdminPage() {
  await exigirAdmin();
  return (
    <div className="animar-entrada">
      <PageHeader titulo="Planos e permissões" />
      <PlanosAdmin />
    </div>
  );
}
