import Link from "next/link";
import type { ReactNode } from "react";
import { exigirAdmin } from "@/lib/auth/dal";
import { obterResumoAdmin } from "@/services/data/server/conteudoAdminActions";
import { contarSolicitacoesPendentes } from "@/services/data/server/verificacaoAdminActions";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";

const reais = (centavos: number) => (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function Indicador({ rotulo, valor, nota }: { rotulo: string; valor: string | number; nota?: string }) {
  return (
    <Card className="flex flex-col gap-0.5">
      <span className="text-xs text-muted">{rotulo}</span>
      <span className="text-2xl font-semibold tabular-nums text-foreground">{valor}</span>
      {nota && <span className="text-xs text-muted">{nota}</span>}
    </Card>
  );
}

function Atalho({ href, titulo, texto, aviso, destaque }: { href: string; titulo: string; texto: string; aviso?: ReactNode; destaque?: boolean }) {
  return (
    <Link href={href}>
      <Card className={`flex h-full flex-col gap-1 transition-colors hover:border-primary/60 hover:bg-surface-2 ${destaque ? "border-primary/50" : ""}`}>
        <span className="font-semibold text-foreground">
          {titulo}
          {aviso}
        </span>
        <span className="text-sm text-muted">{texto}</span>
      </Card>
    </Link>
  );
}

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">{titulo}</h2>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

const pendente = (n: number, singular: string, plural: string) =>
  n > 0 ? <span className="ml-2 text-sm font-medium text-warning">{n} {n === 1 ? singular : plural}</span> : null;

export default async function AdminPage() {
  // Conferido em cada página, e não só no layout: o layout não controla se
  // as páginas filhas renderizam (ver authentication.md do Next).
  await exigirAdmin();
  const [resumo, pendentes] = await Promise.all([obterResumoAdmin(), contarSolicitacoesPendentes()]);
  const { empresas, assinaturas } = resumo;

  return (
    <div className="flex flex-col gap-8 animar-entrada">
      <PageHeader titulo="Administração" />

      <section aria-label="Resumo" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Indicador rotulo="Empresas" valor={empresas.total} nota={`${empresas.emTeste} em teste · ${empresas.ativas} ativas · ${empresas.gratuitas} gratuitas`} />
        <Indicador rotulo="Usuários" valor={resumo.usuarios} />
        <Indicador rotulo="Assinaturas ativas" valor={assinaturas.ativas} nota={`${reais(assinaturas.receitaMensalCentavos)} por mês (estimado)`} />
        <Indicador rotulo="Denúncias abertas" valor={resumo.denunciasAbertas} nota={empresas.bloqueadas > 0 ? `${empresas.bloqueadas} empresa(s) bloqueada(s)` : undefined} />
        <Indicador rotulo="Perfis publicados" valor={resumo.perfisPublicados} />
        <Indicador rotulo="Avaliações" valor={resumo.avaliacoes} />
        <Indicador rotulo="Recomendações" valor={resumo.recomendacoes} />
        <Indicador rotulo="Trabalhos no portfólio" valor={resumo.trabalhos} />
      </section>
      <p className="-mt-5 text-xs text-muted">
        A receita estimada vem só das assinaturas cobradas pelo Mercado Pago (o anual entra dividido por 12). Plano ativado à mão não tem valor e não entra na conta.
      </p>

      <Secao titulo="Preços e planos">
        <Atalho href="/admin/planos-comerciais" destaque titulo="Preços e vagas dos planos" texto="Defina o valor mensal e anual, as vagas do plano fundador, o parcelamento e o que cada plano inclui, e publique para os clientes verem." />
        <Atalho href="/admin/planos" titulo="Planos e permissões" texto="Quais recursos cada plano libera (rede e gestão)." />
        <Atalho href="/admin/empresas" titulo="Plano de cada empresa" texto="Mude o plano, atribua o plano comercial e acompanhe quem está em teste." />
        <Atalho href="/admin/ciclo-de-vida" titulo="Teste e e-mails" texto="Duração do teste, extensões, campanhas de e-mail, quem está parado e falhas de envio." />
      </Secao>

      <Secao titulo="Pessoas e empresas">
        <Atalho href="/admin/empresas" titulo="Empresas" texto="Plano, bloqueio e desbloqueio de cada empresa." />
        <Atalho href="/admin/usuarios" titulo="Usuários" texto="Bloqueie um usuário ou encerre as sessões abertas dele." />
      </Secao>

      <Secao titulo="Conteúdo da rede">
        <Atalho href="/admin/perfis" titulo="Perfis da rede" texto="Suspenda um perfil publicado ou reative um suspenso." />
        <Atalho href="/admin/avaliacoes" titulo="Avaliações" texto="Oculte, remova ou restaure avaliações, com motivo registrado." />
        <Atalho href="/admin/recomendacoes" titulo="Recomendações" texto="Veja quem recomendou quem e remova uma recomendação indevida." />
        <Atalho href="/admin/portfolio" titulo="Portfólio" texto="Trabalhos e fotos que as empresas publicam: veja e remova o que não deve ficar no ar." />
        <Atalho href="/admin/denuncias" titulo="Denúncias" aviso={pendente(resumo.denunciasAbertas, "aberta", "abertas")} texto="Fila de denúncias de avaliações e perfis: analise, peça informações e decida." />
        <Atalho href="/admin/verificacoes" titulo="Verificações" aviso={pendente(pendentes, "pendente", "pendentes")} texto="Selo de verificado, reivindicação de perfil e relação comprovada, com os documentos." />
        <Atalho href="/admin/taxonomia" titulo="Profissões e categorias" texto="Crie, renomeie, organize e desative o que aparece na busca e nos perfis." />
      </Secao>

      <Secao titulo="Acompanhamento">
        <Atalho href="/admin/metricas" titulo="Métricas" texto="Cadastros, ativação, tour, conversão do teste e e-mails, com a fórmula de cada número." />
        <Atalho href="/admin/logs" titulo="Registro de ações" texto="Quem fez o quê na administração, em ordem cronológica." />
      </Secao>
    </div>
  );
}
