"use client";

import Link from "next/link";
import { useEstoque } from "@/hooks/useEstoque";
import { EstoqueLista } from "@/components/estoque/EstoqueLista";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/layout/PageHeader";

export default function EstoquePage() {
  const { produtos, carregando } = useEstoque();

  return (
    <div className="animar-entrada">
      <PageHeader
        titulo="Estoque"
        acao={
          <div className="flex gap-2">
            <Link href="/estoque/deposito">
              <Button tamanho="sm" variante="outline">
                Depósito
              </Button>
            </Link>
            <Link href="/estoque/novo">
              <Button tamanho="sm">+ Novo produto</Button>
            </Link>
          </div>
        }
      />
      <EstoqueLista produtos={produtos} carregando={carregando} />
    </div>
  );
}
