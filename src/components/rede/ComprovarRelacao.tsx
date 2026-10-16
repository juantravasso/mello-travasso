"use client";

import { useEffect, useState } from "react";
import type { AvaliacaoComprovavel } from "@/types";
import { verificacaoRepositorio } from "@/services/data";
import { Card } from "@/components/ui/Card";
import { EstrelasNota } from "./EstrelasNota";
import { NovoPedidoForm } from "./NovoPedidoForm";

export function ComprovarRelacao({ avaliacaoId }: { avaliacaoId: string }) {
  const [avaliacao, setAvaliacao] = useState<AvaliacaoComprovavel | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    verificacaoRepositorio
      .obterAvaliacaoComprovavel(avaliacaoId)
      .then((r) => (r.ok ? setAvaliacao(r.dados) : setErro(r.mensagem)))
      .catch(() => setErro("Não foi possível carregar agora. Tente de novo."));
  }, [avaliacaoId]);

  if (erro) {
    return (
      <Card role="alert" className="max-w-2xl border-danger bg-danger-bg text-sm text-danger">
        {erro}
      </Card>
    );
  }
  if (!avaliacao) {
    return (
      <Card className="h-24 max-w-2xl animate-pulse bg-surface-2" aria-busy="true">
        {null}
      </Card>
    );
  }

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <Card className="flex flex-col gap-2">
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <EstrelasNota nota={avaliacao.nota} tamanho="sm" />
          <span className="font-medium text-foreground">{avaliacao.perfilNome}</span>
        </p>
        <p className="text-sm text-muted">
          Comprovar a relação dá à sua avaliação o selo &ldquo;Relação comprovada por documento&rdquo;, o mais forte. Mostre que você contratou este perfil:
          a administração só confere, nada do documento vai a público, e o arquivo é apagado depois da decisão.
        </p>
      </Card>
      <Card>
        <NovoPedidoForm
          pedido={{ tipo: "relacao_comprovada", avaliacaoId: avaliacao.id }}
          rotuloEnvio="Enviar comprovante"
          orientacoes={[
            "Contrato, orçamento aprovado, nota fiscal ou recibo que mostre as duas partes.",
            "Cubra valores, contas bancárias e dados pessoais que não sejam necessários para provar o vínculo.",
          ]}
        />
      </Card>
    </div>
  );
}
