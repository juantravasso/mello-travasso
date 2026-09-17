"use client";

import Link from "next/link";
import { ObrasLista } from "@/components/obras/ObrasLista";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/layout/PageHeader";

export default function ObrasPage() {
  return (
    <div className="animar-entrada">
      <PageHeader
        titulo="Obras"
        acao={
          <Link href="/obras/novo">
            <Button tamanho="sm">+ Nova obra</Button>
          </Link>
        }
      />
      <ObrasLista />
    </div>
  );
}
