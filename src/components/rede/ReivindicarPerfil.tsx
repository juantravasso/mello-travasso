"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { PerfilReivindicavel } from "@/types";
import { verificacaoRepositorio } from "@/services/data";
import { Card } from "@/components/ui/Card";
import { NovoPedidoForm } from "./NovoPedidoForm";

export function ReivindicarPerfil({ slug }: { slug: string }) {
  const [perfil, setPerfil] = useState<PerfilReivindicavel | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    verificacaoRepositorio
      .obterPerfilReivindicavel(slug)
      .then((r) => (r.ok ? setPerfil(r.dados) : setErro(r.mensagem)))
      .catch(() => setErro("Não foi possível carregar agora. Tente de novo."));
  }, [slug]);

  if (erro) {
    return (
      <Card role="alert" className="max-w-2xl border-danger bg-danger-bg text-sm text-danger">
        {erro}
      </Card>
    );
  }
  if (!perfil) {
    return (
      <Card className="h-24 max-w-2xl animate-pulse bg-surface-2" aria-busy="true">
        {null}
      </Card>
    );
  }

  const local = [perfil.cidade, perfil.estado].filter(Boolean).join("/");
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <Card className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-foreground">{perfil.nome}</h2>
        <p className="text-sm text-muted">
          {perfil.tipo === "pj" ? "Empresa" : "Profissional autônomo"}
          {local && ` · ${local}`} ·{" "}
          <Link href={`/empresas/${perfil.slug}`} className="font-medium text-primary underline underline-offset-4">
            ver a página pública
          </Link>
        </p>
        <p className="text-sm text-muted">
          Este perfil foi criado por indicação de outras empresas. Reivindicar é provar à administração que ele é seu. Nada é vinculado à sua conta
          sem a aprovação de uma pessoa da administração; as avaliações e recomendações que ele já tem ficam no perfil, que passa a ser seu.
        </p>
      </Card>

      {!perfil.documentoConfere ? (
        <Card role="alert" className="border-danger bg-danger-bg text-sm text-danger">
          Este perfil foi indicado com outro CNPJ. Só a empresa titular desse CNPJ pode reivindicá-lo; o pedido não seria aprovado.
        </Card>
      ) : (
        <Card>
          <NovoPedidoForm
            pedido={{ tipo: "reivindicacao_perfil", perfilSlug: perfil.slug }}
            rotuloEnvio="Enviar reivindicação"
            orientacoes={
              perfil.tipo === "pj"
                ? [
                    "Contrato social ou última alteração contratual que mostre você como sócio ou responsável por este CNPJ.",
                    "Se não for sócio: procuração ou carta da empresa, e um documento com foto seu.",
                  ]
                : ["Um documento oficial com foto, com o mesmo nome do perfil.", "Se tiver, algo que comprove a atividade (cartão de profissional, MEI)."]
            }
            confirmacao={
              perfil.temRascunho
                ? "Entendo que o rascunho vazio do meu perfil dará lugar a este, e que o perfil reivindicado volta como rascunho para eu revisar antes de publicar."
                : "Entendo que o perfil volta como rascunho para eu revisar os dados antes de publicar."
            }
          />
        </Card>
      )}
    </div>
  );
}
