import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { MARCA } from "@/lib/marca";
import { IniciarTesteButton } from "./IniciarTesteButton";

const MODULOS = [
  { titulo: "Captura de documentos com IA", texto: "Fotografe notas e recibos; os dados viram lançamentos." },
  { titulo: "Contas a pagar e a receber", texto: "Vencimentos, baixas e histórico de cada lançamento." },
  { titulo: "Projetos e estoque", texto: "Custos por projeto e saldo de materiais em cada projeto." },
  { titulo: "Calendário e lembretes", texto: "Compromissos com aviso por e-mail e no sistema, individuais ou compartilhados com a equipe." },
  { titulo: "Funcionários e fornecedores", texto: "Cadastros ligados aos projetos e aos lançamentos." },
];

export function UpsellGestao({ podeIniciarTeste, diasDeTeste }: { podeIniciarTeste: boolean; diasDeTeste: number }) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 animar-entrada">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-foreground">{MARCA.produtos.gestao.nome}</h1>
        <p className="text-sm text-muted">
          Seu plano inclui o {MARCA.produtos.profissionais.nome}. Os módulos abaixo fazem parte do {MARCA.produtos.gestao.nome}, que você pode experimentar quando quiser.
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
            <IniciarTesteButton dias={diasDeTeste} />
          ) : (
            <p className="text-sm text-muted">Peça ao responsável pela conta para iniciar o teste de {diasDeTeste} dias.</p>
          )}
          <Link
            href="/rede"
            className="inline-flex h-11 items-center justify-center rounded-lg px-4 text-base font-medium text-foreground transition-colors hover:bg-surface-2"
          >
            Voltar ao {MARCA.produtos.profissionais.nome}
          </Link>
        </div>
      </Card>
    </div>
  );
}
