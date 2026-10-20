"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { PlanoComercialPublico } from "@/types";
import type { ContextoOferta } from "@/lib/planos/comercial";
import { formatarPreco } from "@/lib/planos/comercial";
import { obterPlanosPublicos, registrarInteracaoOferta } from "@/services/data/server/planosComerciaisActions";
import { Card } from "@/components/ui/Card";

/**
 * Oferta no contexto em que a pessoa esbarrou num limite. Só existe se a administração publicou algum plano, e mostra
 * o nome e o valor cadastrados (nada inventado). Ver e clicar viram métrica no servidor.
 */
export function OfertaContextual({ contexto, titulo }: { contexto: Exclude<ContextoOferta, "pagina_planos">; titulo: string }) {
  const [plano, setPlano] = useState<PlanoComercialPublico | null>(null);

  useEffect(() => {
    let ativo = true;
    obterPlanosPublicos()
      .then((r) => {
        if (!ativo || !r.ok || r.dados.length === 0) return;
        const escolhido = r.dados.find((p) => p.destaque) ?? r.dados[0]!;
        setPlano(escolhido);
        registrarInteracaoOferta({ contexto, tipo: "visualizada", planoChave: escolhido.chave }).catch(() => undefined);
      })
      .catch(() => undefined);
    return () => {
      ativo = false;
    };
  }, [contexto]);

  if (!plano) return null;
  const preco = formatarPreco(plano.precoMensalCentavos);
  return (
    <Card className="flex flex-wrap items-center justify-between gap-3 border-primary/50">
      <div className="min-w-0">
        <p className="font-medium text-foreground">{titulo}</p>
        <p className="text-sm text-muted">
          {plano.nome}
          {preco ? ` a partir de ${preco} por mês` : ""}: {plano.descricao}
        </p>
      </div>
      <Link
        href="/planos"
        onClick={() => void registrarInteracaoOferta({ contexto, tipo: "clicada", planoChave: plano.chave }).catch(() => undefined)}
        className="inline-flex h-10 items-center justify-center rounded-lg border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-surface-2"
      >
        Ver planos
      </Link>
    </Card>
  );
}
