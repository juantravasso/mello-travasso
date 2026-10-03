import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { IniciarTesteButton } from "./IniciarTesteButton";

const MODULOS = [
  { titulo: "Captura de documentos com IA", texto: "Fotografe notas e recibos; os dados viram lançamentos." },
  { titulo: "Contas a pagar e a receber", texto: "Vencimentos, baixas e histórico de cada lançamento." },
  { titulo: "Obras e estoque", texto: "Custos por obra e saldo de materiais em cada canteiro." },
  { titulo: "Funcionários e fornecedores", texto: "Cadastros ligados às obras e aos lançamentos." },
];

export function UpsellGestao({ podeIniciarTeste }: { podeIniciarTeste: boolean }) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 animar-entrada">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-foreground">Gestão de obras e finanças</h1>
        <p className="text-sm text-muted">
          Seu plano inclui a rede profissional. Os módulos abaixo fazem parte da gestão, que você pode experimentar quando quiser.
        </p>
      </div>

      <Card className="flex flex-col gap-4">
        <ul className="flex flex-col gap-3">
          {MODULOS.map((modulo) => (
            <li key={modulo.titulo} className="flex items-start gap-3 text-sm">
              <span aria-hidden className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
              <span>
                <span className="font-medium text-foreground">{modulo.titulo}</span>
                <span className="block text-muted">{modulo.texto}</span>
              </span>
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-center">
          {podeIniciarTeste ? (
            <IniciarTesteButton />
          ) : (
            <p className="text-sm text-muted">Peça ao responsável pela conta para iniciar o teste de 30 dias.</p>
          )}
          <Link
            href="/rede"
            className="inline-flex h-11 items-center justify-center rounded-lg px-4 text-base font-medium text-foreground transition-colors hover:bg-surface-2"
          >
            Voltar à rede profissional
          </Link>
        </div>
      </Card>
    </div>
  );
}
