import Link from "next/link";
import { exigirAdmin } from "@/lib/auth/dal";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";

export default async function AdminPage() {
  // Conferido em cada página, e não só no layout: o layout não controla se
  // as páginas filhas renderizam (ver authentication.md do Next).
  await exigirAdmin();
  return (
    <div className="animar-entrada">
      <PageHeader titulo="Administração" />
      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/admin/taxonomia">
          <Card className="flex h-full flex-col gap-1 transition-colors hover:border-primary/60 hover:bg-surface-2">
            <span className="font-semibold text-foreground">Profissões e categorias</span>
            <span className="text-sm text-muted">Crie, renomeie, organize e desative o que aparece na busca e nos perfis.</span>
          </Card>
        </Link>
        <Link href="/admin/avaliacoes">
          <Card className="flex h-full flex-col gap-1 transition-colors hover:border-primary/60 hover:bg-surface-2">
            <span className="font-semibold text-foreground">Avaliações</span>
            <span className="text-sm text-muted">Oculte, remova ou restaure avaliações, com motivo registrado.</span>
          </Card>
        </Link>
        <Link href="/admin/perfis">
          <Card className="flex h-full flex-col gap-1 transition-colors hover:border-primary/60 hover:bg-surface-2">
            <span className="font-semibold text-foreground">Perfis da rede</span>
            <span className="text-sm text-muted">Suspenda um perfil publicado ou reative um suspenso.</span>
          </Card>
        </Link>
      </div>
    </div>
  );
}
