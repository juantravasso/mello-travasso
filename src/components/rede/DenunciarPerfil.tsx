"use client";

import { useState } from "react";
import Link from "next/link";
import { DenunciaModal } from "./DenunciaModal";

export function DenunciarPerfil({ slug, logado, proprio }: { slug: string; logado: boolean; proprio: boolean }) {
  const [aberto, setAberto] = useState(false);
  if (proprio) return null;

  const classe = "w-fit text-xs text-muted underline underline-offset-4 hover:text-foreground";
  return (
    <>
      {logado ? (
        <button type="button" onClick={() => setAberto(true)} className={classe}>
          Denunciar este perfil
        </button>
      ) : (
        <Link href={`/login?next=${encodeURIComponent(`/empresas/${slug}`)}`} className={classe}>
          Entre para denunciar este perfil
        </Link>
      )}
      {aberto && <DenunciaModal alvo={{ tipo: "perfil", perfilSlug: slug }} titulo="Denunciar perfil" aoFechar={() => setAberto(false)} />}
    </>
  );
}
