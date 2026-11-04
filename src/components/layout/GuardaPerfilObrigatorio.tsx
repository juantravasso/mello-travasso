"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ROTA_DO_PERFIL, rotaLiberadaSemPerfil } from "@/lib/perfilObrigatorio";

/**
 * Enquanto o responsável não publicou o perfil no Elo Profissionais (obrigatório uma vez, depois do cadastro), qualquer
 * tela fora do Elo Profissionais, de Configurações e de Ajuda leva de volta ao perfil, e uma faixa explica o que falta.
 * É o complemento do servidor (layout e ações): esta guarda cobre a navegação dentro do app, em que o layout não roda de novo.
 */
export function GuardaPerfilObrigatorio({ pendente }: { pendente: boolean }) {
  const caminho = usePathname();
  const router = useRouter();
  const bloqueada = pendente && !rotaLiberadaSemPerfil(caminho);

  useEffect(() => {
    if (bloqueada) router.replace(ROTA_DO_PERFIL);
  }, [bloqueada, router]);

  if (!pendente) return null;
  return (
    <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-warning bg-warning-bg px-4 py-2.5 text-sm text-warning sm:px-8">
      <strong>Falta um passo para liberar o sistema:</strong>
      <span>confirme seu e-mail, complete o perfil (nome, cidade e ao menos uma profissão) e clique em Publicar. Depois disso você pode despublicar quando quiser.</span>
    </div>
  );
}
