"use client";

import Link from "next/link";
import { DepositoVisao } from "@/components/estoque/DepositoVisao";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";

export default function DepositoPage() {
  return (
    <div className="animar-entrada">
      <PageHeader
        titulo="Depósito"
        acao={
          <Link href="/estoque">
            <Button tamanho="sm" variante="outline">
              Estoque geral
            </Button>
          </Link>
        }
      />
      <DepositoVisao />
    </div>
  );
}
