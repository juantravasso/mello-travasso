import { exigirAdmin } from "@/lib/auth/dal";
import { PageHeader } from "@/components/layout/PageHeader";
import { LogsAdmin } from "@/components/admin/LogsAdmin";

export default async function LogsAdminPage() {
  await exigirAdmin();
  return (
    <div className="animar-entrada">
      <PageHeader titulo="Registro de ações" />
      <LogsAdmin />
    </div>
  );
}
