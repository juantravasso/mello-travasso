import { exigirAdmin } from "@/lib/auth/dal";
import { PageHeader } from "@/components/layout/PageHeader";
import { MetricasAdmin } from "@/components/admin/MetricasAdmin";

export default async function MetricasAdminPage() {
  await exigirAdmin();
  return (
    <div className="animar-entrada">
      <PageHeader titulo="Métricas" />
      <MetricasAdmin />
    </div>
  );
}
