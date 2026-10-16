import { exigirAdmin } from "@/lib/auth/dal";
import { PageHeader } from "@/components/layout/PageHeader";
import { UsuariosAdmin } from "@/components/admin/UsuariosAdmin";

export default async function UsuariosAdminPage() {
  await exigirAdmin();
  return (
    <div className="animar-entrada">
      <PageHeader titulo="Usuários" />
      <UsuariosAdmin />
    </div>
  );
}
