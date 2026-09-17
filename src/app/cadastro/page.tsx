"use client";

import { useState } from "react";
import Link from "next/link";
import { ObrasLista } from "@/components/obras/ObrasLista";
import { FuncionariosLista } from "@/components/funcionarios/FuncionariosLista";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/layout/PageHeader";
import { cn } from "@/lib/cn";

type Aba = "obras" | "funcionarios";

export default function CadastroPage() {
  const [aba, setAba] = useState<Aba>("obras");

  return (
    <div className="animar-entrada">
      <PageHeader
        titulo="Cadastro"
        acao={
          <Link href={aba === "obras" ? "/obras/novo" : "/funcionarios/novo"}>
            <Button tamanho="sm">{aba === "obras" ? "+ Nova obra" : "+ Novo funcionário"}</Button>
          </Link>
        }
      />

      <div className="mb-4 inline-flex w-full rounded-lg border border-border bg-surface p-1">
        {(["obras", "funcionarios"] as const).map((opcao) => (
          <button
            key={opcao}
            type="button"
            onClick={() => setAba(opcao)}
            className={cn(
              "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              aba === opcao ? "bg-primary text-primary-foreground" : "text-muted",
            )}
          >
            {opcao === "obras" ? "Obras" : "Funcionários"}
          </button>
        ))}
      </div>

      {aba === "obras" ? <ObrasLista /> : <FuncionariosLista />}
    </div>
  );
}
