import Link from "next/link";
import { exigirAdmin } from "@/lib/auth/dal";
import { contarSolicitacoesPendentes } from "@/services/data/server/verificacaoAdminActions";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";

export default async function AdminPage() {
  // Conferido em cada página, e não só no layout: o layout não controla se
  // as páginas filhas renderizam (ver authentication.md do Next).
  await exigirAdmin();
  const pendentes = await contarSolicitacoesPendentes();
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
        <Link href="/admin/denuncias">
          <Card className="flex h-full flex-col gap-1 transition-colors hover:border-primary/60 hover:bg-surface-2">
            <span className="font-semibold text-foreground">Denúncias</span>
            <span className="text-sm text-muted">Fila de denúncias de avaliações e perfis: analise, peça informações e decida.</span>
          </Card>
        </Link>
        <Link href="/admin/avaliacoes">
          <Card className="flex h-full flex-col gap-1 transition-colors hover:border-primary/60 hover:bg-surface-2">
            <span className="font-semibold text-foreground">Avaliações</span>
            <span className="text-sm text-muted">Oculte, remova ou restaure avaliações, com motivo registrado.</span>
          </Card>
        </Link>
        <Link href="/admin/logs">
          <Card className="flex h-full flex-col gap-1 transition-colors hover:border-primary/60 hover:bg-surface-2">
            <span className="font-semibold text-foreground">Registro de ações</span>
            <span className="text-sm text-muted">Quem fez o quê na administração, em ordem cronológica.</span>
          </Card>
        </Link>
        <Link href="/admin/perfis">
          <Card className="flex h-full flex-col gap-1 transition-colors hover:border-primary/60 hover:bg-surface-2">
            <span className="font-semibold text-foreground">Perfis da rede</span>
            <span className="text-sm text-muted">Suspenda um perfil publicado ou reative um suspenso.</span>
          </Card>
        </Link>
        <Link href="/admin/verificacoes">
          <Card className="flex h-full flex-col gap-1 transition-colors hover:border-primary/60 hover:bg-surface-2">
            <span className="font-semibold text-foreground">
              Verificações{pendentes > 0 && <span className="ml-2 text-sm font-medium text-warning">{pendentes} {pendentes === 1 ? "pendente" : "pendentes"}</span>}
            </span>
            <span className="text-sm text-muted">Selo de verificado, reivindicação de perfil e relação comprovada, com os documentos.</span>
          </Card>
        </Link>
        <Link href="/admin/empresas">
          <Card className="flex h-full flex-col gap-1 transition-colors hover:border-primary/60 hover:bg-surface-2">
            <span className="font-semibold text-foreground">Empresas</span>
            <span className="text-sm text-muted">Plano, bloqueio e desbloqueio de cada empresa.</span>
          </Card>
        </Link>
        <Link href="/admin/usuarios">
          <Card className="flex h-full flex-col gap-1 transition-colors hover:border-primary/60 hover:bg-surface-2">
            <span className="font-semibold text-foreground">Usuários</span>
            <span className="text-sm text-muted">Bloqueie um usuário ou encerre as sessões abertas dele.</span>
          </Card>
        </Link>
        <Link href="/admin/planos">
          <Card className="flex h-full flex-col gap-1 transition-colors hover:border-primary/60 hover:bg-surface-2">
            <span className="font-semibold text-foreground">Planos e permissões</span>
            <span className="text-sm text-muted">Quais recursos cada plano libera.</span>
          </Card>
        </Link>
      </div>
    </div>
  );
}
