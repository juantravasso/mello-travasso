import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/layout/Logo";
import { DATA_TERMOS_ATUAL, VERSAO_TERMOS_ATUAL } from "@/lib/termos";

export const metadata: Metadata = {
  title: "Política de Privacidade | Mello e Travasso",
};

export default function PrivacidadePage() {
  return (
    <main className="mx-auto flex min-h-svh max-w-2xl flex-col gap-8 px-6 py-12">
      <Logo tamanho="md" />

      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.01em] text-foreground">
            Política de Privacidade
          </h1>
          <p className="mt-1 text-sm text-muted">
            Versão {VERSAO_TERMOS_ATUAL} · {DATA_TERMOS_ATUAL}
          </p>
        </div>

        <div className="rounded-lg border border-warning bg-warning-bg px-4 py-3 text-sm text-warning">
          <strong>Rascunho.</strong> Este texto ainda não passou por revisão jurídica — é um placeholder que cobre o
          mínimo de LGPD para o cadastro funcionar. Substitua pelo texto definitivo antes de abrir a plataforma ao
          público.
        </div>

        <section className="flex flex-col gap-4 text-sm leading-relaxed text-foreground">
          <h2 className="text-base font-semibold">1. Quais dados coletamos</h2>
          <p>
            No cadastro: CNPJ ou CPF, razão social ou nome, endereço, telefone, e-mail e senha (guardada com hash,
            nunca em texto simples). No uso do sistema: dados de obras, contas, fornecedores e funcionários que você
            cadastrar, e as imagens de comprovantes enviadas para leitura por IA.
          </p>
          <h2 className="text-base font-semibold">2. Para que usamos</h2>
          <p>
            Só para operar a plataforma: autenticar seu acesso, preencher automaticamente dados de CNPJ (consulta à
            Receita Federal via API pública), e extrair informações de comprovantes que você envia.
          </p>
          <h2 className="text-base font-semibold">3. Com quem compartilhamos</h2>
          <p>
            Com o provedor de IA que processa os comprovantes (Anthropic) e com o provedor de hospedagem do banco de
            dados (Neon/Vercel). Não vendemos nem compartilhamos seus dados com terceiros para fins comerciais.
          </p>
          <h2 className="text-base font-semibold">4. Retenção</h2>
          <p>Mantemos os dados enquanto sua conta estiver ativa. Pedidos de exclusão são atendidos manualmente.</p>
          <h2 className="text-base font-semibold">5. Seus direitos (LGPD)</h2>
          <p>
            Você pode pedir a correção ou exclusão dos seus dados a qualquer momento, entrando em contato com quem
            administra sua conta.
          </p>
          <h2 className="text-base font-semibold">6. Termos de Uso</h2>
          <p>
            Esta política complementa os{" "}
            <Link href="/termos" className="text-primary underline underline-offset-2">
              Termos de Uso
            </Link>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
