import Link from "next/link";
import { primeiraRotaPermitida, type AcessoDaPessoa } from "@/lib/auth/modulos";
import { Card } from "@/components/ui/Card";

/** Tela para quem abriu um módulo que o responsável pela empresa não liberou para a sua conta. */
export function SemAcessoModulo({ pessoa, recursos }: { pessoa: AcessoDaPessoa; recursos: ReadonlySet<string> }) {
  const destino = primeiraRotaPermitida(pessoa, recursos);
  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 animar-entrada">
      <Card className="flex flex-col gap-3" role="alert">
        <h1 className="text-xl font-semibold text-foreground">Você não tem acesso a este módulo</h1>
        <p className="text-sm text-muted">
          O responsável pela empresa escolhe o que cada pessoa acessa. Se você precisa desta área, peça a ele para liberar na tela de Configurações.
        </p>
        <Link
          href={destino}
          className="inline-flex h-11 w-fit items-center rounded-lg bg-primary px-4 text-base font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
        >
          {destino === "/configuracoes" ? "Ir para Configurações" : "Ir para a minha página inicial"}
        </Link>
      </Card>
    </div>
  );
}
