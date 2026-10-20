import { exigirAdmin } from "@/lib/auth/dal";
import { PageHeader } from "@/components/layout/PageHeader";
import { PlanosComerciaisAdmin } from "@/components/admin/PlanosComerciaisAdmin";

export default async function PlanosComerciaisAdminPage() {
  await exigirAdmin();
  return (
    <div className="animar-entrada">
      <PageHeader titulo="Planos comerciais" />
      <PlanosComerciaisAdmin />
    </div>
  );
}
