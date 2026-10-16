import { exigirAdmin } from "@/lib/auth/dal";
import { PageHeader } from "@/components/layout/PageHeader";
import { VerificacoesAdmin } from "@/components/admin/VerificacoesAdmin";

export default async function VerificacoesAdminPage() {
  await exigirAdmin();
  return (
    <div className="animar-entrada">
      <PageHeader titulo="Verificações" />
      <VerificacoesAdmin />
    </div>
  );
}
