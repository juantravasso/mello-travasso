import Link from "next/link";
import { Logo } from "@/components/layout/Logo";

const recursos = [
  "Captura de documentos com IA",
  "Contas a pagar e receber",
  "Gestão de obras",
  "Controle de materiais",
  "Relatórios e indicadores",
];

export default function LandingPage() {
  return (
    <main className="relative flex min-h-svh flex-col justify-between overflow-hidden bg-background px-6 py-8 sm:px-12 sm:py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(var(--color-primary) 1px, transparent 1px), linear-gradient(90deg, var(--color-primary) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 top-1/3 h-[32rem] w-[32rem] rounded-full bg-primary/20 blur-3xl"
      />

      <div className="relative animar-entrada">
        <Logo tamanho="lg" />
      </div>

      <div className="relative flex max-w-2xl flex-col gap-6 animar-entrada">
        <h1 className="text-4xl font-semibold leading-tight text-foreground sm:text-6xl">
          Controle total <br /> das suas obras, <br />
          <span className="text-primary">em um só lugar.</span>
        </h1>
        <p className="max-w-md text-base text-muted sm:text-lg">
          Gestão financeira, documentos e materiais com tecnologia e inteligência artificial para
          construir melhores resultados.
        </p>

        <div className="flex flex-wrap items-center gap-4 pt-2">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:bg-primary-hover hover:shadow-primary/40 active:scale-[0.98]"
          >
            Iniciar
            <span aria-hidden>→</span>
          </Link>
          <Link href="/configuracoes" className="text-sm font-medium text-muted underline-offset-4 hover:text-foreground hover:underline">
            Configurações
          </Link>
        </div>

        <ul className="mt-4 flex flex-col gap-2 text-sm text-muted sm:flex-row sm:flex-wrap sm:gap-x-6 sm:gap-y-2">
          {recursos.map((recurso) => (
            <li key={recurso} className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              {recurso}
            </li>
          ))}
        </ul>
      </div>

      <div className="relative flex flex-col gap-1 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
        <span>MELLO E TRAVASSO — Engenharia que constrói o futuro</span>
      </div>
    </main>
  );
}
