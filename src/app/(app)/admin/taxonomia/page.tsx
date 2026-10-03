import { exigirAdmin } from "@/lib/auth/dal";
import { PageHeader } from "@/components/layout/PageHeader";
import { TaxonomiaAdmin } from "@/components/admin/TaxonomiaAdmin";

export default async function TaxonomiaPage() {
  await exigirAdmin();
  return (
    <div className="animar-entrada">
      <PageHeader titulo="Profissões e categorias" />
      <TaxonomiaAdmin />
    </div>
  );
}
