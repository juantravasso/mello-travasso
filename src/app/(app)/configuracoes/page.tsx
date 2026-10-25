import { Suspense } from "react";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/layout/PageHeader";
import { TrocarSenhaForm } from "@/components/layout/TrocarSenhaForm";
import { EmpresaForm } from "@/components/layout/EmpresaForm";
import { FormasPagamentoConfig } from "@/components/layout/FormasPagamentoConfig";
import { PreferenciasLembretes } from "@/components/layout/PreferenciasLembretes";
import { PreferenciasComunicacao } from "@/components/layout/PreferenciasComunicacao";
import { UsuariosEmpresa } from "@/components/layout/UsuariosEmpresa";
import { ConviteEmpresa } from "@/components/layout/ConviteEmpresa";
import { SairButton } from "@/components/layout/SairButton";
import { exigirSessao } from "@/lib/auth/dal";
import { obterEmpresaAtual } from "@/services/data/server/empresaActions";

export default async function ConfiguracoesPage() {
  const sessao = await exigirSessao();
  const empresa = await obterEmpresaAtual();

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4 animar-entrada">
      <PageHeader titulo="Configurações" />
      <Card className="flex flex-col gap-1">
        <p className="font-medium text-foreground">Sua conta</p>
        <p className="text-sm text-muted">
          {sessao.nome} · {sessao.email}
        </p>
      </Card>
      {empresa && <EmpresaForm empresa={empresa} />}
      {sessao.papel === "dono" && <UsuariosEmpresa />}
      {sessao.papel === "dono" && <ConviteEmpresa />}
      {sessao.papel === "dono" && <FormasPagamentoConfig />}
      <PreferenciasLembretes />
      <PreferenciasComunicacao />
      <Suspense fallback={null}>
        <TrocarSenhaForm />
      </Suspense>
      <SairButton />
      <Card className="flex flex-col gap-2 text-sm text-muted">
        <p>Mais preferências e integrações chegam aqui em breve.</p>
      </Card>
    </div>
  );
}
