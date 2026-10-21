import { OfertaContextual } from "@/components/planos/OfertaContextual";
import { Suspense } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/layout/PageHeader";
import { PreferenciasTemaForm } from "@/components/layout/PreferenciasTemaForm";
import { TrocarSenhaForm } from "@/components/layout/TrocarSenhaForm";
import { EmpresaForm } from "@/components/layout/EmpresaForm";
import { PreferenciasLembretes } from "@/components/layout/PreferenciasLembretes";
import { PreferenciasComunicacao } from "@/components/layout/PreferenciasComunicacao";
import { UsuariosEmpresa } from "@/components/layout/UsuariosEmpresa";
import { ConviteEmpresa } from "@/components/layout/ConviteEmpresa";
import { SairButton } from "@/components/layout/SairButton";
import { exigirSessao } from "@/lib/auth/dal";
import { obterEmpresaAtual, obterStatusPlanoAtual } from "@/services/data/server/empresaActions";

/** RF-20: "Teste — N dias restantes" | "Teste encerrado" | "Cortesia" | "Ativo". */
function rotuloStatusPlano(status: Awaited<ReturnType<typeof obterStatusPlanoAtual>>): string {
  if (status.plano === "teste") {
    if (status.somenteLeitura) return "Teste encerrado";
    return `Teste — ${status.diasRestantes} dia${status.diasRestantes === 1 ? "" : "s"} restante${status.diasRestantes === 1 ? "" : "s"} (até ${status.dataFimFormatada})`;
  }
  if (status.plano === "cortesia") return "Cortesia";
  if (status.plano === "ativo") return "Ativo";
  return "Assinatura inativa (somente leitura)";
}

export default async function ConfiguracoesPage() {
  const sessao = await exigirSessao();
  const [empresa, statusPlano] = await Promise.all([obterEmpresaAtual(), obterStatusPlanoAtual()]);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4 animar-entrada">
      <PageHeader titulo="Configurações" />
      <Card className="flex flex-col gap-1">
        <p className="font-medium text-foreground">Sua conta</p>
        <p className="text-sm text-muted">
          {sessao.nome} · {sessao.email}
        </p>
      </Card>
      <Card className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium text-foreground">Plano</p>
          <p className="text-sm text-muted">{rotuloStatusPlano(statusPlano)}</p>
        </div>
        {statusPlano.somenteLeitura && (
          <span className="rounded-full bg-danger-bg px-2.5 py-1 text-xs font-medium text-danger">Somente leitura</span>
        )}
      </Card>
      {statusPlano.somenteLeitura ? (
        <OfertaContextual contexto="teste_encerrado" titulo="Seu teste terminou. Quer continuar lançando e editando?" />
      ) : (
        <Link href="/planos">
          <Card className="flex flex-col gap-1 transition-colors hover:border-primary/60 hover:bg-surface-2">
            <span className="font-medium text-foreground">Planos</span>
            <span className="text-sm text-muted">Veja o que cada plano inclui e os valores.</span>
          </Card>
        </Link>
      )}
      <Link href="/ajuda">
        <Card className="flex flex-col gap-1 transition-colors hover:border-primary/60 hover:bg-surface-2">
          <span className="font-medium text-foreground">Ajuda e tutoriais</span>
          <span className="text-sm text-muted">Rever o tour, os primeiros passos e o passo a passo de cada área.</span>
        </Card>
      </Link>
      {empresa && <EmpresaForm empresa={empresa} />}
      {sessao.papel === "dono" && <UsuariosEmpresa />}
      {sessao.papel === "dono" && <ConviteEmpresa />}
      <PreferenciasLembretes />
      <PreferenciasComunicacao />
      <PreferenciasTemaForm />
      <Suspense fallback={null}>
        <TrocarSenhaForm />
      </Suspense>
      <SairButton />
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
