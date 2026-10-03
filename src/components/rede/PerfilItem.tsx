import Link from "next/link";
import type { PerfilPublicoResumo } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { AvatarIniciais } from "./AvatarIniciais";

export function localizacao(perfil: { cidade?: string; estado?: string }): string | null {
  if (perfil.cidade && perfil.estado) return `${perfil.cidade}/${perfil.estado}`;
  return perfil.cidade ?? perfil.estado ?? null;
}

export function PerfilItem({ perfil }: { perfil: PerfilPublicoResumo }) {
  const local = localizacao(perfil);
  return (
    <li>
      <Link
        href={`/empresas/${perfil.slug}`}
        className="group flex gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/60 hover:bg-surface-2 focus-visible:border-primary focus-visible:outline-none"
      >
        <AvatarIniciais nome={perfil.nome} />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="truncate font-semibold text-foreground group-hover:text-primary">{perfil.nome}</h3>
            <Badge tom="neutral">{perfil.tipo === "pj" ? "Empresa" : "Autônomo"}</Badge>
          </div>
          {perfil.profissoes.length > 0 && (
            <p className="truncate text-sm text-foreground">{perfil.profissoes.join(" · ")}</p>
          )}
          {local && <p className="text-sm text-muted">{local}</p>}
          {perfil.descricao && <p className="line-clamp-2 text-sm text-muted">{perfil.descricao}</p>}
        </div>
      </Link>
    </li>
  );
}
