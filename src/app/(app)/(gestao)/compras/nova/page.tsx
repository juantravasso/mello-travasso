"use client";

import { PageHeader } from "@/components/layout/PageHeader";
import { useStatusPlano } from "@/components/layout/StatusPlanoContext";
import { Card } from "@/components/ui/Card";
import { CompraForm } from "@/components/compras/CompraForm";

export default function NovaCompraPage() {
  const { somenteLeitura } = useStatusPlano();
  return (
    <div className="mx-auto max-w-4xl animar-entrada">
      <PageHeader titulo="Nova compra" />
      {somenteLeitura ? (
        <Card className="text-sm text-muted">Somente leitura: os dados continuam disponíveis para consulta. Para lançar compras, fale com a equipe.</Card>
      ) : (
        <CompraForm origem="manual" />
      )}
    </div>
  );
}
