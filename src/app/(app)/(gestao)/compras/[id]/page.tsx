"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { CompraDetalhe } from "@/types";
import { CompraForm } from "@/components/compras/CompraForm";
import { CompraLeitura } from "@/components/compras/CompraLeitura";
import { PageHeader } from "@/components/layout/PageHeader";
import { useStatusPlano } from "@/components/layout/StatusPlanoContext";
import { Card } from "@/components/ui/Card";
import { formatarNumeroCompra } from "@/lib/compras";
import { mensagemDeErro } from "@/lib/mensagemErroAcao";
import { comprasRepositorio } from "@/services/data";

export default function CompraPage() {
  const { id } = useParams<{ id: string }>();
  const { somenteLeitura } = useStatusPlano();
  const [compra, setCompra] = useState<CompraDetalhe | null | undefined>(undefined);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    comprasRepositorio
      .obter(id)
      .then((r) => {
        if (!ativo) return;
        if (r.ok) setCompra(r.dados);
        else setErro(r.mensagem);
      })
      .catch((e) => ativo && setErro(mensagemDeErro(e)));
    return () => {
      ativo = false;
    };
  }, [id]);

  return (
    <div className="mx-auto max-w-4xl animar-entrada">
      <PageHeader titulo={compra ? `Compra ${formatarNumeroCompra(compra.numero)}` : "Compra"} />
      {erro ? (
        <p role="alert" className="text-sm text-danger">{erro}</p>
      ) : compra === undefined ? (
        <Card className="h-32 animate-pulse bg-surface-2" aria-busy="true">
          {null}
        </Card>
      ) : compra === null ? (
        <Card className="text-sm text-muted">Compra não encontrada.</Card>
      ) : compra.status === "rascunho" && !somenteLeitura ? (
        <CompraForm compra={compra} origem={compra.origem} />
      ) : (
        <CompraLeitura compra={compra} />
      )}
    </div>
  );
}
