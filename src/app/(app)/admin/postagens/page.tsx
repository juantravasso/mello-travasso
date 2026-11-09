import { exigirAdmin } from "@/lib/auth/dal";
import { PageHeader } from "@/components/layout/PageHeader";
import { FeedAdmin } from "@/components/admin/FeedAdmin";

export default async function PostagensAdminPage() {
  await exigirAdmin();
  return (
    <div className="animar-entrada">
      <PageHeader titulo="Comunidade" />
      <FeedAdmin />
    </div>
  );
}
