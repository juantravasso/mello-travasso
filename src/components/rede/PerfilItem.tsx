import Link from "next/link";
import type { PerfilPublicoResumo } from "@/types";
import { SeloVerificado } from "./SeloVerificado";
import { Badge } from "@/components/ui/Badge";
import { AvatarIniciais } from "./AvatarIniciais";
import { EstrelasNota, formatarNota } from "./EstrelasNota";

export function localizacao(perfil: { cidade?: string; estado?: string }): string | null {
  if (perfil.cidade && perfil.estado) return `${perfil.cidade}/${perfil.estado}`;
  return perfil.cidade ?? perfil.estado ?? null;
}

export function PerfilItem({ perfil }: { perfil: PerfilPublicoResumo }) {
  const local = localizacao(perfil);
  return (
    <li className="min-w-0">
      <Link
        href={`/empresas/${perfil.slug}`}
        className="group flex min-w-0 gap-3 rounded-xl border border-border bg-card p-3 transition-colors sm:gap-4 sm:p-4 hover:border-primary/60 hover:bg-surface-2 focus-visible:border-primary focus-visible:outline-none"
      >
        <AvatarIniciais nome={perfil.nome} logoUrl={perfil.logoUrl} />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="min-w-0 break-words font-semibold text-foreground group-hover:text-primary">{perfil.nome}</h3>
            <Badge tom="neutral">{perfil.tipo === "pj" ? "Empresa" : "Autônomo"}</Badge>
            {perfil.indicado && <Badge tom="info">Indicada pela rede</Badge>}
            {perfil.verificado && <SeloVerificado tipo={perfil.tipo} />}
          </div>
          {perfil.avaliacao && (
            <p className="flex items-center gap-1.5 text-sm">
              <EstrelasNota nota={perfil.avaliacao.media} tamanho="sm" />
              <span className="font-medium text-foreground tabular-nums">{formatarNota(perfil.avaliacao.media)}</span>
              <span className="text-muted tabular-nums">({perfil.avaliacao.total})</span>
            </p>
          )}
          {perfil.profissoes.length > 0 && (
            <p className="break-words text-sm text-foreground">{perfil.profissoes.join(" · ")}</p>
          )}
          {local && (
            <p className="text-sm text-muted">
              {local}
              {perfil.distanciaKm !== undefined && (
                <span className="tabular-nums"> · {perfil.distanciaKm === 0 ? "mesma cidade" : `a ${perfil.distanciaKm} km`}</span>
              )}
            </p>
          )}
          {perfil.descricao && <p className="whitespace-pre-line break-words text-sm text-muted">{perfil.descricao}</p>}
        </div>
      </Link>
    </li>
  );
}
