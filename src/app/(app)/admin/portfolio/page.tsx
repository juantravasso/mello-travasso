import { exigirAdmin } from "@/lib/auth/dal";
import { PageHeader } from "@/components/layout/PageHeader";
import { PortfolioAdmin } from "@/components/admin/ModeracaoConteudoAdmin";

export default async function PortfolioAdminPage() {
  await exigirAdmin();
  return (
    <div className="animar-entrada">
      <PageHeader titulo="Portfólio" />
      <PortfolioAdmin />
    </div>
  );
}
