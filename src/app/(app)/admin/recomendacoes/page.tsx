import { exigirAdmin } from "@/lib/auth/dal";
import { PageHeader } from "@/components/layout/PageHeader";
import { RecomendacoesAdmin } from "@/components/admin/ModeracaoConteudoAdmin";

export default async function RecomendacoesAdminPage() {
  await exigirAdmin();
  return (
    <div className="animar-entrada">
      <PageHeader titulo="Recomendações" />
      <RecomendacoesAdmin />
    </div>
  );
}
