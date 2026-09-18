"use client";

import { useState } from "react";
import Link from "next/link";
import { ObrasLista } from "@/components/obras/ObrasLista";
import { FuncionariosLista } from "@/components/funcionarios/FuncionariosLista";
import { FornecedoresLista } from "@/components/fornecedores/FornecedoresLista";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/layout/PageHeader";
import { cn } from "@/lib/cn";

type Aba = "obras" | "funcionarios" | "fornecedores";

const rotulos: Record<Aba, string> = {
  obras: "Obras",
  funcionarios: "Funcionários",
  fornecedores: "Fornecedores",
};

const hrefsNovo: Record<Aba, string> = {
  obras: "/obras/novo",
  funcionarios: "/funcionarios/novo",
  fornecedores: "/fornecedores/novo",
};

const rotulosNovo: Record<Aba, string> = {
  obras: "+ Nova obra",
  funcionarios: "+ Novo funcionário",
  fornecedores: "+ Novo fornecedor",
};

export default function CadastroPage() {
  const [aba, setAba] = useState<Aba>("obras");

  return (
    <div className="animar-entrada">
      <PageHeader
        titulo="Cadastro"
        acao={
          <Link href={hrefsNovo[aba]}>
            <Button tamanho="sm">{rotulosNovo[aba]}</Button>
          </Link>
        }
      />

      <div className="mb-4 inline-flex w-full rounded-lg border border-border bg-surface p-1">
        {(["obras", "funcionarios", "fornecedores"] as const).map((opcao) => (
          <button
            key={opcao}
            type="button"
            onClick={() => setAba(opcao)}
            className={cn(
              "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              aba === opcao ? "bg-primary text-primary-foreground" : "text-muted",
            )}
          >
            {rotulos[opcao]}
          </button>
        ))}
      </div>

      {aba === "obras" && <ObrasLista />}
      {aba === "funcionarios" && <FuncionariosLista />}
      {aba === "fornecedores" && <FornecedoresLista />}
    </div>
  );
}
