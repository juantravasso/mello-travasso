"use client";

import { useState } from "react";
import Link from "next/link";
import { ObrasLista } from "@/components/obras/ObrasLista";
import { FuncionariosLista } from "@/components/funcionarios/FuncionariosLista";
import { FornecedoresLista } from "@/components/fornecedores/FornecedoresLista";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/layout/PageHeader";
import { useStatusPlano } from "@/components/layout/StatusPlanoContext";
import { cn } from "@/lib/cn";

type Aba = "obras" | "funcionarios" | "fornecedores";

const rotulos: Record<Aba, string> = {
  obras: "Projetos",
  funcionarios: "Funcionários",
  fornecedores: "Fornecedores",
};

// Fornecedores tem seu próprio botão "+ Novo" (abre modal, ver FornecedoresLista) — o header só cobre obras/funcionários.
const hrefsNovo: Record<"obras" | "funcionarios", string> = {
  obras: "/obras/novo",
  funcionarios: "/funcionarios/novo",
};

const rotulosNovo: Record<"obras" | "funcionarios", string> = {
  obras: "+ Novo projeto",
  funcionarios: "+ Novo funcionário",
};

export default function CadastroPage() {
  const [aba, setAba] = useState<Aba>("obras");
  const { somenteLeitura } = useStatusPlano();

  return (
    <div className="animar-entrada">
      <PageHeader
        titulo="Cadastro"
        acao={
          aba === "fornecedores" ? undefined : somenteLeitura ? (
            <Button tamanho="sm" disabled title="Teste encerrado — os dados continuam disponíveis para consulta.">
              {rotulosNovo[aba]}
            </Button>
          ) : (
            <Link href={hrefsNovo[aba]}>
              <Button tamanho="sm">{rotulosNovo[aba]}</Button>
            </Link>
          )
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
