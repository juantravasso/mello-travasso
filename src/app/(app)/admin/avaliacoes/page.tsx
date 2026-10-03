import { exigirAdmin } from "@/lib/auth/dal";
import { PageHeader } from "@/components/layout/PageHeader";
import { AvaliacoesAdmin } from "@/components/admin/AvaliacoesAdmin";

export default async function AvaliacoesAdminPage() {
  await exigirAdmin();
  return (
    <div className="animar-entrada">
      <PageHeader titulo="Avaliações" />
      <AvaliacoesAdmin />
    </div>
  );
}
