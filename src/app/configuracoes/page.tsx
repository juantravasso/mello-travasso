import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/layout/PageHeader";
import { PreferenciasTemaForm } from "@/components/layout/PreferenciasTemaForm";
import { PreferenciasUsuarioForm } from "@/components/layout/PreferenciasUsuarioForm";

export default function ConfiguracoesPage() {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4 animar-entrada">
      <PageHeader titulo="Configurações" />
      <PreferenciasTemaForm />
      <PreferenciasUsuarioForm />
      <Card className="flex flex-col gap-2 text-sm text-muted">
        <p>Mais preferências e integrações chegam aqui em breve.</p>
        <p>
          A leitura de comprovantes por IA é configurada via variável de ambiente{" "}
          <code className="rounded bg-surface-2 px-1.5 py-0.5 text-xs text-foreground">ANTHROPIC_API_KEY</code> — veja o{" "}
          <code className="rounded bg-surface-2 px-1.5 py-0.5 text-xs text-foreground">README.md</code> do projeto.
        </p>
      </Card>
    </div>
  );
}
