import Link from "next/link";
import type { AvaliacaoPublica } from "@/types";
import { rotuloAspecto } from "@/lib/rede/aspectos";
import { formatarDataBr } from "@/lib/rede/texto";
import { Badge } from "@/components/ui/Badge";
import { EstrelasNota } from "./EstrelasNota";

export function Aspectos({ pros, contras }: { pros: string[]; contras: string[] }) {
  if (pros.length === 0 && contras.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      {pros.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">Prós</span>
          {pros.map((chave) => (
            <Badge key={chave} tom="success">
              {rotuloAspecto(chave)}
            </Badge>
          ))}
        </div>
      )}
      {contras.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">Contras</span>
          {contras.map((chave) => (
            <Badge key={chave} tom="danger">
              {rotuloAspecto(chave)}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

export function AvaliacaoCard({ avaliacao }: { avaliacao: AvaliacaoPublica }) {
  return (
    <article className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <EstrelasNota nota={avaliacao.nota} tamanho="sm" />
        <span className="text-sm font-medium text-foreground">
          {avaliacao.avaliadorSlug ? (
            <Link href={`/empresas/${avaliacao.avaliadorSlug}`} className="hover:text-primary">
              {avaliacao.avaliadorNome}
            </Link>
          ) : (
            avaliacao.avaliadorNome
          )}
        </span>
        <span className="text-xs text-muted">
          {formatarDataBr(avaliacao.criadoEm)}
          {avaliacao.editadaEm && <> · editada em {formatarDataBr(avaliacao.editadaEm)}</>}
        </span>
      </header>

      {avaliacao.comentario && <p className="whitespace-pre-line text-sm text-foreground/90">{avaliacao.comentario}</p>}

      <p className="text-xs text-muted">
        {avaliacao.verificacao === "nao_verificada"
          ? "Relação comercial não verificada"
          : avaliacao.verificacao === "relacao_confirmada"
            ? "Relação comercial confirmada"
            : "Relação comercial verificada"}
      </p>

      <Aspectos pros={avaliacao.pros} contras={avaliacao.contras} />

      {avaliacao.resposta && (
        <div className="flex flex-col gap-1 rounded-lg border-l-2 border-primary bg-surface px-3 py-2">
          <p className="text-xs text-muted">
            Resposta de <span className="font-medium text-foreground">{avaliacao.resposta.autorNome}</span> ·{" "}
            {formatarDataBr(avaliacao.resposta.criadoEm)}
            {avaliacao.resposta.editadaEm && <> · editada em {formatarDataBr(avaliacao.resposta.editadaEm)}</>}
          </p>
          <p className="whitespace-pre-line text-sm text-foreground/90">{avaliacao.resposta.texto}</p>
        </div>
      )}
    </article>
  );
}
