import { exigirAdmin } from "@/lib/auth/dal";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmpresasAdmin } from "@/components/admin/EmpresasAdmin";

export default async function EmpresasAdminPage() {
  await exigirAdmin();
  return (
    <div className="animar-entrada">
      <PageHeader titulo="Empresas" />
      <EmpresasAdmin />
    </div>
  );
}
