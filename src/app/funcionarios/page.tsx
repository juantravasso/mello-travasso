"use client";

import Link from "next/link";
import { FuncionariosLista } from "@/components/funcionarios/FuncionariosLista";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/layout/PageHeader";

export default function FuncionariosPage() {
  return (
    <div className="animar-entrada">
      <PageHeader
        titulo="Funcionários"
        acao={
          <Link href="/funcionarios/novo">
            <Button tamanho="sm">+ Novo funcionário</Button>
          </Link>
        }
      />
      <FuncionariosLista />
    </div>
  );
}
