import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/layout/Logo";
import { DATA_TERMOS_ATUAL, VERSAO_TERMOS_ATUAL } from "@/lib/termos";

export const metadata: Metadata = {
  title: "Termos de Uso",
};

export default function TermosPage() {
  return (
    <main className="mx-auto flex min-h-svh max-w-2xl flex-col gap-8 px-6 py-12">
      <Logo tamanho="md" />

      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.01em] text-foreground">Termos de Uso</h1>
          <p className="mt-1 text-sm text-muted">
            Versão {VERSAO_TERMOS_ATUAL} · {DATA_TERMOS_ATUAL}
          </p>
        </div>

        <div className="rounded-lg border border-warning bg-warning-bg px-4 py-3 text-sm text-warning">
          <strong>Rascunho.</strong> Este texto ainda não passou por revisão jurídica — é um placeholder que cobre o
          mínimo para o cadastro funcionar. Substitua pelo texto definitivo antes de abrir a plataforma ao público.
        </div>

        <section className="flex flex-col gap-4 text-sm leading-relaxed text-foreground">
          <p>
            Estes Termos regulam o uso do sistema de gestão financeira de obras oferecido pela Mello e Travasso
            (&ldquo;nós&rdquo;, &ldquo;a plataforma&rdquo;) pela empresa ou profissional que criar uma conta
            (&ldquo;você&rdquo;, &ldquo;a conta&rdquo;).
          </p>
          <h2 className="text-base font-semibold">1. O que a plataforma faz</h2>
          <p>
            Controle de contas a pagar e a receber, cadastro de obras, fornecedores e funcionários, e leitura
            automatizada de comprovantes por inteligência artificial.
          </p>
          <h2 className="text-base font-semibold">2. Sua conta</h2>
          <p>
            Você é responsável por manter sua senha em sigilo e por tudo que acontecer na sua conta. Avise-nos se
            suspeitar de acesso indevido.
          </p>
          <h2 className="text-base font-semibold">3. Período de teste</h2>
          <p>
            Novas contas começam com 30 dias de acesso gratuito. Depois desse período, sem um plano pago ativo, a
            conta passa a permitir só consulta dos dados já cadastrados, sem novos lançamentos.
          </p>
          <h2 className="text-base font-semibold">4. Seus dados</h2>
          <p>
            Os dados financeiros e cadastrais que você inserir pertencem a você; usamos apenas para operar a
            plataforma. Veja a{" "}
            <Link href="/privacidade" className="text-primary underline underline-offset-2">
              Política de Privacidade
            </Link>{" "}
            para detalhes.
          </p>
          <h2 className="text-base font-semibold">5. Cancelamento</h2>
          <p>Você pode encerrar sua conta a qualquer momento entrando em contato com a equipe.</p>
          <h2 className="text-base font-semibold">6. Contato</h2>
          <p>Dúvidas sobre estes Termos: fale com quem administra sua conta na plataforma.</p>
        </section>
      </div>
    </main>
  );
}
