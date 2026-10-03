import { exigirAdmin } from "@/lib/auth/dal";
import { PageHeader } from "@/components/layout/PageHeader";
import { DenunciasAdmin } from "@/components/admin/DenunciasAdmin";

export default async function DenunciasAdminPage() {
  await exigirAdmin();
  return (
    <div className="animar-entrada">
      <PageHeader titulo="Denúncias" />
      <DenunciasAdmin />
    </div>
  );
}
