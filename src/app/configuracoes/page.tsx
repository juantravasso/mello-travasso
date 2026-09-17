import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/layout/PageHeader";

export default function ConfiguracoesPage() {
  return (
    <div className="mx-auto max-w-xl animar-entrada">
      <PageHeader titulo="Configurações" />
      <Card className="flex flex-col gap-2 text-sm text-muted">
        <p>Preferências da conta e integrações chegam aqui em breve.</p>
        <p>
          A leitura de comprovantes por IA é configurada via variável de ambiente{" "}
          <code className="rounded bg-surface-2 px-1.5 py-0.5 text-xs text-foreground">ANTHROPIC_API_KEY</code> — veja o{" "}
          <code className="rounded bg-surface-2 px-1.5 py-0.5 text-xs text-foreground">README.md</code> do projeto.
        </p>
      </Card>
    </div>
  );
}
